"""Orquestra o motor de classificação mensal (Quadro 5) a partir dos dados já
gravados no Supabase.

Este módulo faz a ponte entre o banco (I/O) e o motor de classificação puro
(`motor_classificacao/classificacao.py`): lê `reclamacoes`, `acoes_judiciais` e
`carteira_produzida` do mês, monta os agregados por correspondente e grava o
resultado em `classificacoes_mensais`.

É chamado automaticamente ao final de `etl_reclamacoes.py`, e também pode ser
rodado sozinho (útil quando a `carteira_produzida` só é carregada depois da
ingestão das reclamações do mês):

    python -m etl.calcular_classificacoes --mes-referencia 2026-08
"""

from __future__ import annotations

import argparse
import logging

import pandas as pd
from supabase import Client

from etl.supabase_client import obter_client_service_role
from motor_classificacao.classificacao import (
    AgregadoMensalCorrespondente,
    ResultadoClassificacaoMensal,
    classificar_mensal,
)

logger = logging.getLogger(__name__)


def montar_agregados_mensais(
    mes_referencia: str,
    reclamacoes: pd.DataFrame,
    acoes_judiciais: pd.DataFrame,
    carteira_por_correspondente: dict[str, int],
) -> list[AgregadoMensalCorrespondente]:
    """Função pura: recebe dataframes já filtrados no mês (colunas
    `correspondente_id`, `procedente_corban`) e o mapa de denominadores, e
    devolve um agregado por correspondente — pronto para `classificar_mensal`.

    Correspondentes sem nenhuma reclamação/ação no mês, mas com carteira
    carregada, também entram (o art. 69, II exige reportar mesmo quando o
    número de reclamações é zero).
    """
    ids_com_ocorrencia = set(reclamacoes.get("correspondente_id", pd.Series(dtype=str))) | set(
        acoes_judiciais.get("correspondente_id", pd.Series(dtype=str))
    )
    todos_os_ids = ids_com_ocorrencia | set(carteira_por_correspondente)

    agregados = []
    for correspondente_id in sorted(todos_os_ids):
        rec = reclamacoes[reclamacoes.get("correspondente_id") == correspondente_id] if not reclamacoes.empty else reclamacoes
        acoes = (
            acoes_judiciais[acoes_judiciais.get("correspondente_id") == correspondente_id]
            if not acoes_judiciais.empty
            else acoes_judiciais
        )

        agregados.append(
            AgregadoMensalCorrespondente(
                correspondente_id=correspondente_id,
                mes_referencia=mes_referencia,
                qtd_reclamacoes_procedentes_corban=int(rec["procedente_corban"].sum()) if len(rec) else 0,
                qtd_acoes_procedentes_corban=int(acoes["procedente_corban"].sum()) if len(acoes) else 0,
                qtd_reclamacoes_mes=len(rec),
                total_operacoes=carteira_por_correspondente.get(correspondente_id),
            )
        )
    return agregados


def _buscar_todas_paginas(query):
    """O client Python do Supabase pagina em blocos de 1000 por padrão."""
    linhas: list[dict] = []
    inicio = 0
    tamanho_pagina = 1000
    while True:
        resposta = query.range(inicio, inicio + tamanho_pagina - 1).execute()
        bloco = resposta.data or []
        linhas.extend(bloco)
        if len(bloco) < tamanho_pagina:
            break
        inicio += tamanho_pagina
    return linhas


def calcular_classificacoes_do_mes(client: Client, mes_referencia: str) -> list[ResultadoClassificacaoMensal]:
    """Lê o estado atual do banco para `mes_referencia`, calcula a
    classificação de cada correspondente e grava em `classificacoes_mensais`.
    """
    reclamacoes_raw = _buscar_todas_paginas(
        client.table("reclamacoes").select("correspondente_id,procedente_corban").eq("mes_referencia", mes_referencia)
    )
    acoes_raw = _buscar_todas_paginas(
        client.table("acoes_judiciais")
        .select("correspondente_id,procedente_corban")
        .eq("mes_referencia", mes_referencia)
    )
    carteira_raw = _buscar_todas_paginas(
        client.table("carteira_produzida")
        .select("correspondente_id,total_operacoes")
        .eq("mes_referencia", mes_referencia)
    )

    df_reclamacoes = pd.DataFrame(reclamacoes_raw or [], columns=["correspondente_id", "procedente_corban"])
    df_acoes = pd.DataFrame(acoes_raw or [], columns=["correspondente_id", "procedente_corban"])
    carteira_por_correspondente = {linha["correspondente_id"]: linha["total_operacoes"] for linha in carteira_raw}

    agregados = montar_agregados_mensais(mes_referencia, df_reclamacoes, df_acoes, carteira_por_correspondente)
    resultados = [classificar_mensal(agregado) for agregado in agregados]

    if resultados:
        gravar_classificacoes(client, agregados, resultados)

    return resultados


def gravar_classificacoes(
    client: Client,
    agregados: list[AgregadoMensalCorrespondente],
    resultados: list[ResultadoClassificacaoMensal],
) -> None:
    """Grava o resultado do motor em `classificacoes_mensais`, incluindo os
    sub-totais usados no cálculo (data lineage — NFR de auditabilidade)."""
    linhas = [
        {
            "correspondente_id": resultado.correspondente_id,
            "mes_referencia": resultado.mes_referencia,
            "qtd_reclamacoes_procedentes_corban": agregado.qtd_reclamacoes_procedentes_corban,
            "qtd_acoes_procedentes_corban": agregado.qtd_acoes_procedentes_corban,
            "qtd_reclamacoes_mes": agregado.qtd_reclamacoes_mes,
            "numerador": resultado.numerador,
            "denominador_carteira": resultado.denominador,
            "total_operacoes": resultado.denominador,
            "indice": resultado.indice,
            "aplicavel": resultado.aplicavel,
            "status": resultado.status,
        }
        for agregado, resultado in zip(agregados, resultados)
    ]

    client.table("classificacoes_mensais").upsert(linhas, on_conflict="correspondente_id,mes_referencia").execute()
    logger.info("Classificação mensal gravada para %d correspondente(s).", len(linhas))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Recalcula a classificação mensal (Quadro 5) a partir do que já está no Supabase.")
    parser.add_argument("--mes-referencia", required=True, help="Mês de referência no formato YYYY-MM.")
    args = parser.parse_args()

    client = obter_client_service_role()
    resultados = calcular_classificacoes_do_mes(client, args.mes_referencia)

    for resultado in resultados:
        logger.info(
            "correspondente=%s status=%s indice=%s aplicavel=%s",
            resultado.correspondente_id,
            resultado.status,
            resultado.indice,
            resultado.aplicavel,
        )


if __name__ == "__main__":
    main()
