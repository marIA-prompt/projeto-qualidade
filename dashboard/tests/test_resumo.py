import pandas as pd

from dashboard.resumo import (
    contar_por_atribuicao,
    formatar_indice_percentual,
    montar_visao_geral,
    rotulo_status,
    tipo_mais_frequente,
)


def test_contar_por_atribuicao_separa_corban_senff_e_indefinido():
    registros = [
        {"responsavel": "corban", "parecer_detalhado": "procedente"},
        {"responsavel": "corban", "parecer_detalhado": "improcedente"},
        {"responsavel": "senff", "parecer_detalhado": "procedente"},
        {"responsavel": "indefinido", "parecer_detalhado": None},
    ]
    resumo = contar_por_atribuicao(registros)
    assert resumo == {"total": 4, "procedentes_corban": 1, "procedentes_senff": 1, "indefinidos": 1}


def test_tipo_mais_frequente_ignora_nulos():
    registros = [
        {"tipo_reclamacao": "Contesta saque ou cartão"},
        {"tipo_reclamacao": "Contesta saque ou cartão"},
        {"tipo_reclamacao": None},
        {"tipo_reclamacao": "Oferta indevida de portabilidade"},
    ]
    assert tipo_mais_frequente(registros) == "Contesta saque ou cartão"


def test_tipo_mais_frequente_vazio_retorna_none():
    assert tipo_mais_frequente([]) is None


def test_formatar_indice_percentual():
    assert formatar_indice_percentual(None) == "—"
    assert formatar_indice_percentual(0.0007) == "0.0700%"


def test_rotulo_status_conhecido_e_desconhecido():
    assert "Conforme" in rotulo_status("conforme")
    assert "Não conforme" in rotulo_status("nao_conforme")
    assert rotulo_status(None) == rotulo_status("sem_classificacao")


def test_montar_visao_geral_agrega_por_correspondente():
    reclamacoes = pd.DataFrame(
        [
            {"correspondente_id": "c1", "responsavel": "corban", "parecer_detalhado": "procedente", "tipo_reclamacao": "X"},
            {"correspondente_id": "c1", "responsavel": "indefinido", "parecer_detalhado": None, "tipo_reclamacao": "Y"},
            {"correspondente_id": "c2", "responsavel": "senff", "parecer_detalhado": "procedente", "tipo_reclamacao": "X"},
        ]
    )
    acoes = pd.DataFrame(
        [{"correspondente_id": "c1", "responsavel": "corban", "parecer_detalhado": "procedente", "tipo_reclamacao": None}]
    )
    classificacoes = pd.DataFrame(
        [{"correspondente_id": "c1", "status": "nao_conforme", "indice": 0.0005, "id": "class-1"}]
    )

    visao = montar_visao_geral({"c1": "Correspondente 1", "c2": "Correspondente 2"}, reclamacoes, acoes, classificacoes)
    visao = visao.set_index("correspondente_id")

    assert visao.loc["c1", "reclamacoes_total"] == 2
    assert visao.loc["c1", "reclamacoes_procedentes_corban"] == 1
    assert visao.loc["c1", "reclamacoes_indefinidas"] == 1
    assert visao.loc["c1", "acoes_total"] == 1
    assert visao.loc["c1", "status"] == "nao_conforme"
    assert visao.loc["c1", "classificacao_mensal_id"] == "class-1"

    assert visao.loc["c2", "reclamacoes_total"] == 1
    assert visao.loc["c2", "reclamacoes_procedentes_senff"] == 1
    assert pd.isna(visao.loc["c2", "status"])
    assert pd.isna(visao.loc["c2", "classificacao_mensal_id"])
