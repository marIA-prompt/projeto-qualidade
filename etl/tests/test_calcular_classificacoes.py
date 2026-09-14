import pandas as pd

from etl.calcular_classificacoes import montar_agregados_mensais
from motor_classificacao.classificacao import classificar_mensal


def test_monta_agregado_por_correspondente_a_partir_de_dataframes():
    reclamacoes = pd.DataFrame(
        [
            {"correspondente_id": "corr-1", "procedente_corban": True},
            {"correspondente_id": "corr-1", "procedente_corban": False},
            {"correspondente_id": "corr-2", "procedente_corban": True},
        ]
    )
    acoes = pd.DataFrame([{"correspondente_id": "corr-1", "procedente_corban": True}])
    carteira = {"corr-1": 10_000, "corr-3": 500}

    agregados = montar_agregados_mensais("2026-08", reclamacoes, acoes, carteira)
    por_id = {a.correspondente_id: a for a in agregados}

    assert set(por_id) == {"corr-1", "corr-2", "corr-3"}

    assert por_id["corr-1"].qtd_reclamacoes_procedentes_corban == 1
    assert por_id["corr-1"].qtd_acoes_procedentes_corban == 1
    assert por_id["corr-1"].qtd_reclamacoes_mes == 2
    assert por_id["corr-1"].total_operacoes == 10_000

    # corr-2 tem ocorrência mas nenhuma carteira carregada -> motor deve marcar não aplicável.
    assert por_id["corr-2"].total_operacoes is None
    resultado_corr2 = classificar_mensal(por_id["corr-2"])
    assert resultado_corr2.status == "nao_aplicavel"

    # corr-3 tem carteira mas nenhuma ocorrência no mês (ainda deve ser reportado, art. 69, II).
    assert por_id["corr-3"].qtd_reclamacoes_mes == 0
    assert por_id["corr-3"].qtd_reclamacoes_procedentes_corban == 0


def test_sem_nenhum_dado_nao_gera_agregados():
    vazio = pd.DataFrame(columns=["correspondente_id", "procedente_corban"])
    agregados = montar_agregados_mensais("2026-08", vazio, vazio, {})
    assert agregados == []
