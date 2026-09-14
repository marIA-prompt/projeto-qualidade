"""Testes do ETL de reclamações/ações judiciais.

O teste principal (`test_resumo_mensal_bate_com_planilha_de_conferencia`) roda
o pipeline completo contra as exportações REAIS de agosto/2026 (fixtures) e
compara, linha a linha, com `agregado_mensal_esperado_2026-08.csv` — a
planilha que a área já havia calculado manualmente para aquele mês. Zero
divergência aqui é a garantia de que o ETL implementa exatamente as regras
de negócio confirmadas com dados reais (seção 6 do briefing).
"""

from pathlib import Path

import pandas as pd
import pytest

from etl.transform import (
    RESPONSAVEL_INDEFINIDO,
    cruzar_ocorrencias,
    deduplicar_por_contrato,
    extrair_correspondentes,
    ler_export_detalhada,
    ler_export_normal,
    montar_resumo_mensal,
    processar_mes,
    separar_por_tipo,
)

FIXTURES = Path(__file__).parent / "fixtures"
CAMINHO_NORMAL = FIXTURES / "exportacao_reclamacoes_2026-08.csv"
CAMINHO_DETALHADA = FIXTURES / "exportacao_detalhada_2026-08.csv"
CAMINHO_ESPERADO = FIXTURES / "agregado_mensal_esperado_2026-08.csv"
MES_REFERENCIA = "2026-08"


@pytest.fixture(scope="module")
def resultado_pipeline():
    return processar_mes(CAMINHO_NORMAL, CAMINHO_DETALHADA, MES_REFERENCIA)


class TestLeituraDosExports:
    def test_le_export_normal(self):
        df = ler_export_normal(CAMINHO_NORMAL)
        assert len(df) == 494
        assert "Parecer" in df.columns

    def test_le_export_detalhada(self):
        df = ler_export_detalhada(CAMINHO_DETALHADA)
        assert len(df) == 263
        assert set(df["Tipo de Ocorrência"].unique()) == {"1", "4"}


class TestResumoMensalContraPlanilhaDeConferencia:
    """Compara o resumo calculado pelo ETL, linha a linha, com a planilha que
    a área já validou manualmente para agosto/2026."""

    def test_resumo_mensal_bate_com_planilha_de_conferencia(self, resultado_pipeline):
        resumo = resultado_pipeline["resumo_mensal"].set_index("cnpj_correspondente")
        esperado = pd.read_csv(CAMINHO_ESPERADO, sep=";", encoding="utf-8-sig", dtype=str).set_index(
            "cnpj_correspondente"
        )

        colunas_numericas = [
            "qtd_reclamacoes_total",
            "qtd_reclamacoes_procedentes_corban",
            "qtd_reclamacoes_procedentes_senff",
            "qtd_reclamacoes_indefinidas",
            "qtd_acoes_judiciais_total",
            "qtd_acoes_judiciais_procedentes_corban",
            "qtd_acoes_judiciais_procedentes_senff",
            "qtd_acoes_judiciais_indefinidas",
            "qtd_encaminhadas_fraudes",
            "numerador_indice_quadro5",
        ]

        assert set(resumo.index) == set(esperado.index)

        divergencias = []
        for cnpj in esperado.index:
            linha_calculada = resumo.loc[cnpj]
            linha_esperada = esperado.loc[cnpj]

            for coluna in colunas_numericas:
                valor_calculado = int(linha_calculada[coluna])
                valor_esperado = int(linha_esperada[coluna])
                if valor_calculado != valor_esperado:
                    divergencias.append((cnpj, coluna, valor_calculado, valor_esperado))

            tipo_calculado = linha_calculada["tipo_ocorrencia_mais_frequente"]
            tipo_calculado = "" if pd.isna(tipo_calculado) else tipo_calculado
            tipo_esperado = linha_esperada["tipo_ocorrencia_mais_frequente"]
            tipo_esperado = "" if pd.isna(tipo_esperado) else tipo_esperado
            if tipo_calculado != tipo_esperado:
                divergencias.append((cnpj, "tipo_ocorrencia_mais_frequente", tipo_calculado, tipo_esperado))

        assert not divergencias, f"Divergências encontradas (cnpj, coluna, calculado, esperado): {divergencias}"

    def test_totais_gerais_batem(self, resultado_pipeline):
        resumo = resultado_pipeline["resumo_mensal"]
        assert resumo["qtd_reclamacoes_total"].sum() == 155
        assert resumo["qtd_acoes_judiciais_total"].sum() == 108


class TestRegrasDeNegocio:
    def test_indefinidos_nao_entram_no_numerador(self, resultado_pipeline):
        reclamacoes = resultado_pipeline["reclamacoes"]
        indefinidos = reclamacoes[reclamacoes["responsavel"] == RESPONSAVEL_INDEFINIDO]

        assert len(indefinidos) > 0, "esperado ter casos indefinidos nos dados reais de agosto/2026"
        assert not indefinidos["procedente_corban"].any()
        assert not indefinidos["procedente_senff"].any()

    def test_proporcao_de_indefinidos_bate_com_achado_do_briefing(self, resultado_pipeline):
        # O briefing confirma que ~25% (66 de 263) dos registros da detalhada
        # não têm par na normal do mês corrente.
        reclamacoes = resultado_pipeline["reclamacoes"]
        acoes = resultado_pipeline["acoes_judiciais"]
        total = len(reclamacoes) + len(acoes)
        total_indefinidos = (reclamacoes["responsavel"] == RESPONSAVEL_INDEFINIDO).sum() + (
            acoes["responsavel"] == RESPONSAVEL_INDEFINIDO
        ).sum()

        assert total == 263
        assert total_indefinidos == 66

    def test_setor_origem_mapeia_1_para_1_com_tipo_ocorrencia(self):
        df_normal = ler_export_normal(CAMINHO_NORMAL)
        df_detalhada = ler_export_detalhada(CAMINHO_DETALHADA)
        unificado = cruzar_ocorrencias(df_detalhada, df_normal, MES_REFERENCIA)

        pares = unificado.dropna(subset=["canal_origem"])[["tipo_ocorrencia", "canal_origem"]].drop_duplicates()
        acao_judicial = pares[pares["tipo_ocorrencia"] == "1"]["canal_origem"].unique()
        reclamacao = pares[pares["tipo_ocorrencia"] == "4"]["canal_origem"].unique()

        assert set(acao_judicial) == {"Ação judicial"}
        assert "Ação judicial" not in reclamacao

    def test_reclamacoes_e_acoes_sao_mutuamente_exclusivas(self, resultado_pipeline):
        ids_reclamacoes = set(resultado_pipeline["reclamacoes"]["identificador_ocorrencia"])
        ids_acoes = set(resultado_pipeline["acoes_judiciais"]["identificador_ocorrencia"])
        assert ids_reclamacoes.isdisjoint(ids_acoes)

    def test_correspondentes_extraidos_tem_cnpjs_unicos(self, resultado_pipeline):
        correspondentes = resultado_pipeline["correspondentes"]
        assert correspondentes["cnpj"].is_unique
        assert len(correspondentes) == 25


class TestDeduplicacaoPorContrato:
    def test_dedup_mantem_primeiro_registro_quando_mesmo_contrato_em_dois_canais(self):
        df = pd.DataFrame(
            [
                {
                    "correspondente_cnpj": "111",
                    "tipo_ocorrencia": "4",
                    "numero_contrato": "CTR-1",
                    "identificador_ocorrencia": "a",
                },
                {
                    "correspondente_cnpj": "111",
                    "tipo_ocorrencia": "4",
                    "numero_contrato": "CTR-1",
                    "identificador_ocorrencia": "b",
                },
            ]
        )
        resultado = deduplicar_por_contrato(df)
        assert len(resultado) == 1
        assert resultado.iloc[0]["identificador_ocorrencia"] == "a"

    def test_dedup_nao_afeta_registros_sem_numero_de_contrato(self):
        df = pd.DataFrame(
            [
                {"correspondente_cnpj": "111", "tipo_ocorrencia": "4", "numero_contrato": None, "identificador_ocorrencia": "a"},
                {"correspondente_cnpj": "111", "tipo_ocorrencia": "4", "numero_contrato": None, "identificador_ocorrencia": "b"},
            ]
        )
        resultado = deduplicar_por_contrato(df)
        assert len(resultado) == 2
