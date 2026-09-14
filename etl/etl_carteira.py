"""Ingestão manual da carteira produzida — denominador do Quadro 5 (art. 9º).

Nenhuma das exportações do navigate traz a volumetria. Até a fonte oficial
ser confirmada, a área carrega uma planilha neste formato (veja
`etl/modelo_carteira_produzida.csv`):

    cnpj;nome;operacoes_mes;operacoes_acumuladas_desde_2023;fonte

`operacoes_acumuladas_desde_2023` é o denominador do índice (art. 9º).
`operacoes_mes` é opcional (fica registrado para conferência).

Depois de gravar, o script recalcula `classificacoes_mensais` do mês —
não é preciso reimportar os CSVs do navigate.

Uso:
    python etl/etl_carteira.py --arquivo carteira_2026-08.csv --mes 2026-08

    python etl/etl_carteira.py --arquivo carteira_2026-08.csv --mes 2026-08 --dry-run
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import date
from pathlib import Path

import pandas as pd

RAIZ_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ_REPO / "etl"))
sys.path.insert(0, str(RAIZ_REPO))

from etl_reclamacoes import (  # noqa: E402
    _criar_cliente_supabase,
    reclassificar_mes,
)

log = logging.getLogger("etl_carteira")

COLUNAS_OBRIGATORIAS = ["cnpj", "operacoes_acumuladas_desde_2023"]


def carregar_planilha(caminho: str) -> pd.DataFrame:
    """Lê CSV com `;` ou `,` e valida o mínimo para gravar a carteira."""
    bruto = Path(caminho).read_text(encoding="utf-8-sig", errors="replace")[:2048]
    sep = ";" if bruto.count(";") >= bruto.count(",") else ","
    df = pd.read_csv(caminho, sep=sep, dtype=str)
    df.columns = [c.strip().lower() for c in df.columns]
    # aceita o nome longo do schema ou o apelido curto
    if "cnpj_correspondente" in df.columns and "cnpj" not in df.columns:
        df = df.rename(columns={"cnpj_correspondente": "cnpj"})
    if "nome_correspondente" in df.columns and "nome" not in df.columns:
        df = df.rename(columns={"nome_correspondente": "nome"})
    faltantes = [c for c in COLUNAS_OBRIGATORIAS if c not in df.columns]
    if faltantes:
        raise ValueError(
            f"Planilha sem as colunas obrigatórias {faltantes}. "
            "Use etl/modelo_carteira_produzida.csv como modelo."
        )
    for col in df.columns:
        df[col] = df[col].str.strip()
    df["cnpj"] = df["cnpj"].str.replace(r"\D", "", regex=True)
    if df["cnpj"].eq("").any() or df["cnpj"].isna().any():
        raise ValueError("Há linhas sem CNPJ.")
    if df["cnpj"].duplicated().any():
        dups = df.loc[df["cnpj"].duplicated(), "cnpj"].tolist()
        raise ValueError(f"CNPJ duplicado na planilha: {dups}")
    df["operacoes_acumuladas_desde_2023"] = pd.to_numeric(
        df["operacoes_acumuladas_desde_2023"], errors="coerce"
    )
    if df["operacoes_acumuladas_desde_2023"].isna().any():
        raise ValueError("operacoes_acumuladas_desde_2023 precisa ser um inteiro ≥ 0.")
    df["operacoes_acumuladas_desde_2023"] = df["operacoes_acumuladas_desde_2023"].astype(int)
    if (df["operacoes_acumuladas_desde_2023"] < 0).any():
        raise ValueError("operacoes_acumuladas_desde_2023 não pode ser negativo.")
    if "operacoes_mes" in df.columns:
        df["operacoes_mes"] = pd.to_numeric(df["operacoes_mes"], errors="coerce")
    else:
        df["operacoes_mes"] = pd.NA
    if "nome" not in df.columns:
        df["nome"] = None
    if "fonte" not in df.columns:
        df["fonte"] = "manual"
    df["fonte"] = df["fonte"].fillna("manual")
    return df


def gravar_carteira(sb, df: pd.DataFrame, mes: date) -> int:
    mes_iso = mes.isoformat()
    gravados = 0
    for _, linha in df.iterrows():
        cnpj = linha["cnpj"]
        nome = linha["nome"] if pd.notna(linha["nome"]) and str(linha["nome"]).strip() else cnpj
        existente = sb.table("correspondentes").select("id").eq("cnpj", cnpj).execute()
        if existente.data:
            corr_id = existente.data[0]["id"]
        else:
            criado = sb.table("correspondentes").insert({"cnpj": cnpj, "nome": nome}).execute()
            corr_id = criado.data[0]["id"]
        payload = {
            "correspondente_id": corr_id,
            "mes_referencia": mes_iso,
            "operacoes_acumuladas_desde_2023": int(linha["operacoes_acumuladas_desde_2023"]),
            "fonte": str(linha["fonte"]),
        }
        if pd.notna(linha["operacoes_mes"]):
            payload["operacoes_mes"] = int(linha["operacoes_mes"])
        sb.table("carteira_produzida").upsert(
            payload, on_conflict="correspondente_id,mes_referencia"
        ).execute()
        gravados += 1
    return gravados


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--arquivo", required=True, help="CSV da carteira produzida")
    parser.add_argument("--mes", required=True, help="Mês de referência, formato YYYY-MM")
    parser.add_argument("--dry-run", action="store_true", help="Valida o CSV sem gravar no banco")
    args = parser.parse_args()

    try:
        ano, mes_num = map(int, args.mes.split("-"))
        mes = date(ano, mes_num, 1)
    except ValueError:
        raise SystemExit(f"--mes inválido: {args.mes!r}. Use YYYY-MM, ex.: 2026-08")

    df = carregar_planilha(args.arquivo)
    log.info("%d correspondentes na planilha para %s.", len(df), args.mes)
    if args.dry_run:
        log.info("Dry-run: planilha válida. Nada foi gravado.")
        return

    sb = _criar_cliente_supabase()
    n = gravar_carteira(sb, df, mes)
    log.info("Carteira gravada para %d correspondentes.", n)
    reclassificar_mes(sb, mes)
    log.info("Classificação mensal recalculada.")


if __name__ == "__main__":
    main()
