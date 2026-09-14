"""Testes das regras de transformação do ETL com dados sintéticos (sem PII).

Rodar a partir da raiz do repositório:  pytest etl/
"""

from datetime import date

import pandas as pd

from etl_reclamacoes import agregar_mensal, transformar

MES = date(2026, 8, 1)


def _detalhada(linhas):
    cols = ["Tipo de Ocorrência", "Cnpj do correspondente", "CPF do agente",
            "CPF do cliente", "Data da ocorrência", "Data de encerramento",
            "Parecer", "Data Inicio do contrato", "Identificador da ocorrência"]
    return pd.DataFrame(linhas, columns=cols)


def _normal(linhas):
    cols = ["Protocolo", "Data Cadastro", "Setor Origem", "Nome Cliente",
            "CPF Cliente", "Nº Contrato", "Nome Corban", "CNPJ Corban",
            "Tipo Reclamação", "Parecer", "Encaminhou ao Fraudes"]
    df = pd.DataFrame(linhas, columns=cols)
    # completa as demais colunas do layout real com vazio
    for extra in ["Hora Cadastro", "Usuário Cadastro", "Data Aprovação", "Convênio",
                  "Digitador", "CPF Digitador", "Data Finalização", "Hora Finalização",
                  "Usuário Finalização", "Observações Cadastro", "Observações Fraude"]:
        df[extra] = None
    return df


def _cenario_base():
    detalhada = _detalhada([
        # ocorr-1: reclamação procedente, par na normal diz Corban -> conta no índice
        ["4", "111", "ag1", "cli1", "01/07/2026", "05/08/2026", "Procedente", "01/01/2026", "occ-1"],
        # ocorr-2: reclamação procedente, par na normal diz Senff -> NÃO conta
        ["4", "111", "ag1", "cli2", "02/07/2026", "06/08/2026", "Procedente", "01/01/2026", "occ-2"],
        # ocorr-3: sem par na normal (aberta em mês anterior) -> indefinido
        ["4", "111", "ag2", "cli3", "01/06/2026", "07/08/2026", "Procedente", "01/01/2026", "occ-3"],
        # ocorr-4: ação judicial procedente-Corban -> conta no índice
        ["1", "111", "ag1", "cli4", "03/07/2026", "08/08/2026", "Procedente", "01/01/2026", "occ-4"],
        # ocorr-5 e occ-6: mesma reclamação (mesmo contrato) em dois canais -> dedupe
        ["4", "222", "ag3", "cli5", "04/07/2026", "09/08/2026", "Improcedente", "01/01/2026", "occ-5"],
        ["4", "222", "ag3", "cli5", "04/07/2026", "10/08/2026", "Improcedente", "01/01/2026", "occ-6"],
        # occ-7: ação judicial do MESMO contrato de occ-5 -> indicador distinto, não dedupa
        ["1", "222", "ag3", "cli5", "04/07/2026", "11/08/2026", "Improcedente", "01/01/2026", "occ-7"],
    ])
    normal = _normal([
        ["occ-1", "01/08/2026", "Procon", "Cliente 1", "cli1", "C-1", "CORBAN A", "111",
         "Contesta saque ou cartão", "Procedente - Corban", "Fulano"],
        ["occ-2", "02/08/2026", "Bacen", "Cliente 2", "cli2", "C-2", "CORBAN A", "111",
         "Oferta indevida de portabilidade", "Procedente - Senff", None],
        ["occ-4", "03/08/2026", "Ação judicial", "Cliente 4", "cli4", "C-4", "CORBAN A", "111",
         "Quitação de contrato", "Procedente - Corban", None],
        ["occ-5", "04/08/2026", "Procon", "Cliente 5", "cli5", "C-5", "CORBAN B", "222",
         "Contesta saque ou cartão", "Improcedente - Corban", None],
        ["occ-6", "05/08/2026", "Ouvidoria", "Cliente 5", "cli5", "C-5", "CORBAN B", "222",
         "Contesta saque ou cartão", "Improcedente - Corban", None],
        ["occ-7", "06/08/2026", "Ação judicial", "Cliente 5", "cli5", "C-5", "CORBAN B", "222",
         "Contesta saque ou cartão", "Improcedente - Corban", None],
    ])
    return transformar(detalhada, normal, MES)


def test_atribuicao_de_responsavel_vem_do_export_normal():
    df, _ = _cenario_base()
    por_id = df.set_index("id")
    assert por_id.loc["occ-1", "responsavel"] == "corban"
    assert por_id.loc["occ-2", "responsavel"] == "senff"
    assert por_id.loc["occ-4", "responsavel"] == "corban"


def test_registro_sem_par_fica_indefinido():
    df, rel = _cenario_base()
    assert df.set_index("id").loc["occ-3", "responsavel"] == "indefinido"
    assert rel.sem_par_na_normal == 1


def test_dedupe_unitariedade_somente_dentro_do_mesmo_tipo():
    df, rel = _cenario_base()
    por_id = df.set_index("id")
    # segunda reclamação do mesmo contrato: duplicada
    assert bool(por_id.loc["occ-6", "duplicada_unitariedade"]) is True
    # ação judicial do mesmo contrato: indicador distinto, não é duplicada
    assert bool(por_id.loc["occ-7", "duplicada_unitariedade"]) is False
    assert rel.duplicadas_unitariedade == 1


def test_agregado_numerador_soma_apenas_procedentes_corban():
    df, _ = _cenario_base()
    agg = agregar_mensal(df).set_index("cnpj_correspondente")
    a = agg.loc["111"]
    # occ-1 (reclamação corban) + occ-4 (ação corban); occ-2 (senff) e occ-3
    # (indefinido) ficam de fora do numerador.
    assert a["numerador_indice_quadro5"] == 2
    assert a["qtd_reclamacoes_total"] == 3
    assert a["qtd_reclamacoes_indefinidas"] == 1
    assert a["qtd_acoes_judiciais_total"] == 1

    b = agg.loc["222"]
    assert b["qtd_reclamacoes_total"] == 1      # occ-5 (occ-6 deduplicada)
    assert b["qtd_acoes_judiciais_total"] == 1  # occ-7
    assert b["numerador_indice_quadro5"] == 0   # improcedentes não contam


def test_tipo_mais_frequente_considera_apenas_reclamacoes():
    df, _ = _cenario_base()
    agg = agregar_mensal(df).set_index("cnpj_correspondente")
    # Para o corban 111, "Quitação de contrato" é de uma ação judicial e não
    # pode influenciar; entre as reclamações não há moda repetida, vale a 1ª.
    assert agg.loc["111", "tipo_ocorrencia_mais_frequente"] in (
        "Contesta saque ou cartão", "Oferta indevida de portabilidade"
    )
    assert agg.loc["222", "tipo_ocorrencia_mais_frequente"] == "Contesta saque ou cartão"
