"""Carrega um dump do navigate cobrindo vários meses.

A base motriz continua sendo a detalhada por data de encerramento. O script
parte o dump por mês e reusa transformar()/carregar_no_banco() do ETL mensal.

Por padrão NÃO regrava meses listados em --pular-meses (agosto/2026 ficou
validado campo a campo com o fechamento oficial).

Uso:
    python etl/carregar_periodo.py \\
        --detalhada exportacao_detalhada.csv \\
        --normal exportacao_reclamacoes.csv \\
        --pular-meses 2026-08
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import date
from pathlib import Path

import pandas as pd

RAIZ_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ_REPO))
sys.path.insert(0, str(RAIZ_REPO / "etl"))

from etl_reclamacoes import (  # noqa: E402
    agregar_mensal,
    carregar_detalhada,
    carregar_no_banco,
    carregar_normal,
    transformar,
    _criar_cliente_supabase,
    _parse_data,
)

log = logging.getLogger("carregar_periodo")


def meses_do_dump(detalhada: pd.DataFrame) -> list[date]:
    enc = _parse_data(detalhada["Data de encerramento"])
    periodos = sorted({d.replace(day=1) for d in enc.dropna()})
    return periodos


def recortar_mes(detalhada: pd.DataFrame, mes: date) -> pd.DataFrame:
    enc = _parse_data(detalhada["Data de encerramento"])
    mask = enc.apply(lambda d: (not pd.isna(d)) and d.year == mes.year and d.month == mes.month)
    return detalhada.loc[mask].copy()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--detalhada", required=True)
    parser.add_argument("--normal", required=True)
    parser.add_argument(
        "--pular-meses",
        default="2026-08",
        help="Meses YYYY-MM separados por vírgula que NÃO serão regravados",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    pular = set()
    for item in str(args.pular_meses or "").split(","):
        item = item.strip()
        if not item:
            continue
        ano, mes_num = map(int, item.split("-"))
        pular.add(date(ano, mes_num, 1))

    detalhada = carregar_detalhada(args.detalhada)
    normal = carregar_normal(args.normal)
    meses = meses_do_dump(detalhada)
    log.info("Dump com %d registros detalhados em %d mês(es): %s", len(detalhada), len(meses), [m.strftime("%Y-%m") for m in meses])

    sb = None if args.dry_run else _criar_cliente_supabase()
    for mes in meses:
        chave = mes.strftime("%Y-%m")
        if mes in pular:
            log.info("Pula %s (mês já validado / --pular-meses).", chave)
            continue
        fatia = recortar_mes(detalhada, mes)
        df, rel = transformar(fatia, normal, mes)
        agregado = agregar_mensal(df)
        log.info(
            "%s: %d ocorrências (%d rec / %d aj) em %d correspondentes. avisos=%d",
            chave,
            len(df),
            int((df["tipo_ocorrencia"] == "4").sum()),
            int((df["tipo_ocorrencia"] == "1").sum()),
            len(agregado),
            len(rel.avisos),
        )
        for aviso in rel.avisos:
            log.warning("%s: %s", chave, aviso)
        if args.dry_run:
            continue
        carregar_no_banco(sb, df, agregado, mes)
        log.info("Carga concluída para %s.", chave)

    if args.dry_run:
        log.info("Dry-run: nada foi enviado ao banco.")
        return

    from classificar_anual import classificar_anos  # noqa: WPS433

    anos = sorted({m.year for m in meses})
    classificar_anos(sb, anos)
    log.info("Classificação anual gravada para %s.", anos)


if __name__ == "__main__":
    main()
