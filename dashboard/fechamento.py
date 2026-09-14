"""Export do fechamento mensal a partir do que o schema V1 já guarda.

Não reproduz `qtd_encaminhadas_fraudes` nem `tipo_reclamacao` — essas colunas
não existem nas tabelas de ocorrência aplicadas no Supabase.
"""

from __future__ import annotations

import io

import pandas as pd

from etl.etl_reclamacoes import e_procedente_corban


def e_procedente_senff(responsavel, parecer) -> bool:
    if responsavel != "senff" or parecer is None:
        return False
    return str(parecer).strip().lower().startswith("procedente")


def _conta(ocorrencias: list[dict], cid: str) -> dict:
    recorte = [o for o in ocorrencias if o.get("correspondente_id") == cid]
    return {
        "total": len(recorte),
        "corban": sum(
            1 for o in recorte if e_procedente_corban(o.get("responsavel"), o.get("parecer"))
        ),
        "senff": sum(
            1 for o in recorte if e_procedente_senff(o.get("responsavel"), o.get("parecer"))
        ),
        "indefinidas": sum(1 for o in recorte if o.get("responsavel") == "indefinido"),
    }


def montar_export_fechamento(
    df_mes: pd.DataFrame,
    reclamacoes: list[dict] | None = None,
    acoes: list[dict] | None = None,
) -> pd.DataFrame:
    """Monta o CSV do analista com o que o painel consegue derivar do banco."""
    if df_mes is None or df_mes.empty:
        return pd.DataFrame()
    rec = reclamacoes or []
    aj = acoes or []
    linhas = []
    for _, row in df_mes.iterrows():
        cid = row["correspondente_id"]
        r = _conta(rec, cid) if rec else None
        a = _conta(aj, cid) if aj else None
        linhas.append({
            "mes_referencia": str(row.get("mes_referencia") or "")[:7],
            "cnpj_correspondente": row.get("cnpj"),
            "nome_correspondente": row.get("correspondente"),
            "qtd_reclamacoes_total": int(row.get("qtd_reclamacoes") or 0) if r is None else r["total"],
            "qtd_reclamacoes_procedentes_corban": (
                int(row.get("qtd_reclamacoes_corban") or 0) if r is None else r["corban"]
            ),
            "qtd_reclamacoes_procedentes_senff": None if r is None else r["senff"],
            "qtd_reclamacoes_indefinidas": (
                int(row.get("qtd_indefinidas") or 0) if r is None else r["indefinidas"]
            ),
            "qtd_acoes_judiciais_total": (
                int(row.get("qtd_acoes_judiciais") or 0) if a is None else a["total"]
            ),
            "qtd_acoes_judiciais_procedentes_corban": (
                int(row.get("qtd_acoes_judiciais_corban") or 0) if a is None else a["corban"]
            ),
            "qtd_acoes_judiciais_procedentes_senff": None if a is None else a["senff"],
            "qtd_acoes_judiciais_indefinidas": None if a is None else a["indefinidas"],
            "canal_mais_frequente": row.get("canal_mais_frequente") or "",
            "numerador_indice_quadro5": int(row.get("numerador") or 0),
            "carteira_denominador": row.get("carteira_denominador"),
            "indice": row.get("indice"),
            "status": row.get("status"),
        })
    return pd.DataFrame(linhas)


def csv_fechamento(df: pd.DataFrame) -> bytes:
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode("utf-8-sig")


def carregar_ocorrencias_do_mes(sb, mes: str) -> tuple[list[dict], list[dict]]:
    alvo = str(mes)[:10]
    rec = (
        sb.table("reclamacoes")
        .select("correspondente_id, responsavel, parecer")
        .eq("mes_referencia", alvo)
        .execute()
        .data
        or []
    )
    aj = (
        sb.table("acoes_judiciais")
        .select("correspondente_id, responsavel, parecer")
        .eq("mes_referencia", alvo)
        .execute()
        .data
        or []
    )
    return rec, aj
