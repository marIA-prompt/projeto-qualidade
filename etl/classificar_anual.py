"""Calcula e grava classificacoes_anuais (Quadro 3) a partir do que já está no banco."""

from __future__ import annotations

import argparse
import logging
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

RAIZ_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ_REPO))
sys.path.insert(0, str(RAIZ_REPO / "etl"))

from etl_reclamacoes import _criar_cliente_supabase, e_procedente_corban  # noqa: E402
from motor_classificacao.anual import (  # noqa: E402
    classificar_anual,
    pontuacao_geral,
    pontuacao_operacional,
)

log = logging.getLogger("classificar_anual")


def _ano(valor) -> int | None:
    if valor is None:
        return None
    texto = str(valor)[:4]
    try:
        n = int(texto)
    except ValueError:
        return None
    return n if 2000 <= n <= 2100 else None


def classificar_anos(sb, anos: list[int]) -> int:
    rec = sb.table("reclamacoes").select("correspondente_id, mes_referencia, responsavel, parecer").execute().data or []
    aj = sb.table("acoes_judiciais").select("correspondente_id, mes_referencia, responsavel, parecer").execute().data or []
    ext = sb.table("auditorias_externas").select("correspondente_id, pontuacao, data_avaliacao").execute().data or []
    intern = sb.table("auditorias_internas").select("correspondente_id, pontuacao, data_avaliacao").execute().data or []
    cors = sb.table("correspondentes").select("id").eq("ativo", True).execute().data or []
    gravadas = sb.table("classificacoes_anuais").select("correspondente_id, ano_referencia, desvio_conduta_grave").execute().data or []

    desvio_por = {
        (g["correspondente_id"], g["ano_referencia"]): bool(g.get("desvio_conduta_grave"))
        for g in gravadas
    }

    rec_por = defaultdict(list)
    for r in rec:
        a = _ano(r.get("mes_referencia"))
        if a:
            rec_por[(r["correspondente_id"], a)].append(r)
    aj_por = defaultdict(list)
    for r in aj:
        a = _ano(r.get("mes_referencia"))
        if a:
            aj_por[(r["correspondente_id"], a)].append(r)
    notas_por = defaultdict(list)
    for r in [*ext, *intern]:
        a = _ano(r.get("data_avaliacao"))
        if a and r.get("pontuacao") is not None:
            notas_por[(r["correspondente_id"], a)].append(float(r["pontuacao"]))

    ids = {c["id"] for c in cors}
    ids |= {cid for cid, _ in rec_por} | {cid for cid, _ in aj_por} | {cid for cid, _ in notas_por}

    linhas = []
    for ano in anos:
        for cid in ids:
            rec_c = rec_por.get((cid, ano), [])
            aj_c = aj_por.get((cid, ano), [])
            numerador = sum(1 for r in rec_c if e_procedente_corban(r.get("responsavel"), r.get("parecer"))) + sum(
                1 for r in aj_c if e_procedente_corban(r.get("responsavel"), r.get("parecer"))
            )
            total = len(rec_c) + len(aj_c)
            op = pontuacao_operacional(numerador, total)
            notas = notas_por.get((cid, ano), [])
            qual = round(sum(notas) / len(notas), 2) if notas else None
            geral = pontuacao_geral([op, qual])
            desvio = desvio_por.get((cid, ano), False)
            resultado = classificar_anual(pontuacao_geral_valor=geral, desvio_conduta_grave=desvio)
            linhas.append({
                "correspondente_id": cid,
                "ano_referencia": ano,
                "pontuacao_geral": resultado.pontuacao,
                "desvio_conduta_grave": desvio,
                "status": None if resultado.status == "nao_aplicavel" else resultado.status,
                "calculado_em": datetime.now(timezone.utc).isoformat(),
            })
    if linhas:
        sb.table("classificacoes_anuais").upsert(linhas, on_conflict="correspondente_id,ano_referencia").execute()
    log.info("classificacoes_anuais: %d linhas para anos %s", len(linhas), anos)
    return len(linhas)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--ano", type=int, help="Ano (default: todos os anos presentes no banco)")
    args = parser.parse_args()
    sb = _criar_cliente_supabase()
    if args.ano:
        anos = [args.ano]
    else:
        rec = sb.table("reclamacoes").select("mes_referencia").execute().data or []
        anos = sorted({a for a in (_ano(r.get("mes_referencia")) for r in rec) if a})
        if not anos:
            anos = [datetime.now(timezone.utc).year]
    classificar_anos(sb, anos)


if __name__ == "__main__":
    main()
