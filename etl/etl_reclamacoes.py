"""CLI do ETL de Reclamações e Ações Judiciais (FR-1 / FR-2).

Lê as duas exportações do navigate de um mês fechado, aplica as regras de
negócio (`etl/transform.py`), grava `correspondentes`, `reclamacoes` e
`acoes_judiciais` no Supabase (via `service_role key`) e, em seguida, tenta
calcular a classificação mensal do Quadro 5 (`etl/calcular_classificacoes.py`)
para os correspondentes que já tiverem `carteira_produzida` carregada.

Uso:

    python -m etl.etl_reclamacoes \\
        --normal caminho/exportacao_reclamacoes_2026-08.csv \\
        --detalhada caminho/exportacao_detalhada_2026-08.csv \\
        --mes-referencia 2026-08

Use `--dry-run` para rodar toda a transformação e imprimir o resumo no
console sem gravar nada no banco — útil para o analista conferir antes do
fechamento do dia 25.
"""

from __future__ import annotations

import argparse
import logging
import math
from typing import Optional

import pandas as pd
from supabase import Client

from etl.calcular_classificacoes import calcular_classificacoes_do_mes
from etl.supabase_client import obter_client_service_role
from etl.transform import processar_mes

logger = logging.getLogger(__name__)

_COLUNAS_OCORRENCIA_PARA_TABELA = [
    "mes_referencia",
    "identificador_ocorrencia",
    "protocolo_normal",
    "numero_contrato",
    "cpf_agente",
    "cpf_cliente",
    "canal_origem",
    "tipo_reclamacao",
    "data_ocorrencia",
    "data_encerramento",
    "data_cadastro_normal",
    "parecer_detalhado",
    "responsavel",
    "procedente_corban",
    "encaminhado_fraudes",
]


def _valor_serializavel(valor):
    """Converte tipos do pandas (Timestamp, NaT, NaN, numpy bool) para tipos
    nativos que o client Supabase (JSON) aceita."""
    if valor is None:
        return None
    if isinstance(valor, pd.Timestamp):
        return None if pd.isna(valor) else valor.strftime("%Y-%m-%d")
    if isinstance(valor, float) and math.isnan(valor):
        return None
    if valor is pd.NaT:
        return None
    if isinstance(valor, (pd.BooleanDtype, bool)):
        return bool(valor)
    return valor


def _linhas_para_upsert(df: pd.DataFrame, correspondente_por_cnpj: dict[str, str]) -> list[dict]:
    linhas = []
    for _, linha in df.iterrows():
        registro = {coluna: _valor_serializavel(linha[coluna]) for coluna in _COLUNAS_OCORRENCIA_PARA_TABELA}
        registro["correspondente_id"] = correspondente_por_cnpj[linha["correspondente_cnpj"]]
        linhas.append(registro)
    return linhas


def upsert_correspondentes(client: Client, correspondentes: pd.DataFrame) -> dict[str, str]:
    """Garante que cada CNPJ visto no mês exista em `correspondentes` e
    devolve o mapa cnpj -> id (uuid) para popular as FKs das outras tabelas.
    """
    linhas = [
        {"cnpj": linha["cnpj"], "nome": _valor_serializavel(linha["nome"])}
        for _, linha in correspondentes.iterrows()
    ]
    if not linhas:
        return {}

    client.table("correspondentes").upsert(linhas, on_conflict="cnpj", ignore_duplicates=False).execute()

    cnpjs = [linha["cnpj"] for linha in linhas]
    resposta = client.table("correspondentes").select("id,cnpj").in_("cnpj", cnpjs).execute()
    return {registro["cnpj"]: registro["id"] for registro in resposta.data}


def gravar_ocorrencias(client: Client, tabela: str, df: pd.DataFrame, correspondente_por_cnpj: dict[str, str]) -> int:
    if df.empty:
        return 0
    linhas = _linhas_para_upsert(df, correspondente_por_cnpj)
    client.table(tabela).upsert(linhas, on_conflict="identificador_ocorrencia").execute()
    return len(linhas)


def rodar_etl(
    caminho_normal: str,
    caminho_detalhada: str,
    mes_referencia: str,
    client: Optional[Client] = None,
) -> dict:
    """Executa o pipeline completo: transformação em memória + gravação no
    Supabase + cálculo best-effort da classificação mensal.
    """
    resultado = processar_mes(caminho_normal, caminho_detalhada, mes_referencia)

    if client is None:
        client = obter_client_service_role()

    correspondente_por_cnpj = upsert_correspondentes(client, resultado["correspondentes"])

    qtd_reclamacoes = gravar_ocorrencias(client, "reclamacoes", resultado["reclamacoes"], correspondente_por_cnpj)
    qtd_acoes = gravar_ocorrencias(client, "acoes_judiciais", resultado["acoes_judiciais"], correspondente_por_cnpj)

    logger.info(
        "Gravados: %d correspondente(s), %d reclamação(ões), %d ação(ões) judicial(is) para %s.",
        len(correspondente_por_cnpj),
        qtd_reclamacoes,
        qtd_acoes,
        mes_referencia,
    )

    try:
        classificacoes = calcular_classificacoes_do_mes(client, mes_referencia)
        qtd_aplicaveis = sum(1 for c in classificacoes if c.aplicavel)
        logger.info(
            "Classificação mensal calculada para %d correspondente(s) (%d aplicável(is) — "
            "os demais ficam 'nao_aplicavel' até a carteira_produzida do mês ser carregada).",
            len(classificacoes),
            qtd_aplicaveis,
        )
    except Exception:  # noqa: BLE001 — não deve derrubar a ingestão já concluída
        logger.exception(
            "Não foi possível calcular a classificação mensal agora (provavelmente falta "
            "carteira_produzida). Rode depois com: python -m etl.calcular_classificacoes --mes-referencia %s",
            mes_referencia,
        )

    return resultado


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--normal", required=True, help="Caminho do CSV exportacao_reclamacoes_*.csv")
    parser.add_argument("--detalhada", required=True, help="Caminho do CSV exportacao_detalhada_*.csv")
    parser.add_argument("--mes-referencia", required=True, help="Mês de referência no formato YYYY-MM (ex.: 2026-08)")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Roda toda a transformação e imprime o resumo por correspondente, sem gravar no Supabase.",
    )
    args = parser.parse_args()

    if args.dry_run:
        resultado = processar_mes(args.normal, args.detalhada, args.mes_referencia)
        resumo = resultado["resumo_mensal"]
        with pd.option_context("display.max_rows", None, "display.width", 200):
            print(resumo.to_string(index=False))
        print(f"\n[dry-run] {len(resultado['correspondentes'])} correspondente(s) no mês {args.mes_referencia}. Nada foi gravado no Supabase.")
        return

    rodar_etl(args.normal, args.detalhada, args.mes_referencia)


if __name__ == "__main__":
    main()
