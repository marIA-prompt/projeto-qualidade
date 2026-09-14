"""UI de auditorias externas/internas (FR-3) — entrada manual por pilar."""

from __future__ import annotations

from datetime import date

import pandas as pd
import streamlit as st

from pilares import (
    PILARES,
    ROTULOS_NOTA,
    SUBCRITERIOS,
    TIPOS_AUDITORIA,
    pontuacao_pilar,
)


def _rotulo_corr(c: dict) -> str:
    return f"{c['nome']} ({c['cnpj']})"


def resumo_auditorias(sb) -> pd.DataFrame:
    """Última avaliação (data + média de pontuação) por correspondente e tipo."""
    correspondentes = (
        sb.table("correspondentes").select("id, nome, cnpj").order("nome").execute().data
        or []
    )
    linhas = []
    for tipo, (tabela, rotulo) in TIPOS_AUDITORIA.items():
        rows = (
            sb.table(tabela)
            .select("correspondente_id, pilar, pontuacao, data_avaliacao")
            .execute()
            .data
            or []
        )
        by_corr: dict[str, list] = {}
        for r in rows:
            by_corr.setdefault(r["correspondente_id"], []).append(r)
        for c in correspondentes:
            recs = by_corr.get(c["id"], [])
            if not recs:
                linhas.append({
                    "correspondente_id": c["id"],
                    "correspondente": c["nome"],
                    "cnpj": c["cnpj"],
                    "tipo": rotulo,
                    "data": None,
                    "pilares": 0,
                    "media": None,
                })
                continue
            ultima = max(r["data_avaliacao"] for r in recs)
            na_data = [r for r in recs if r["data_avaliacao"] == ultima]
            notas = [float(r["pontuacao"]) for r in na_data if r.get("pontuacao") is not None]
            linhas.append({
                "correspondente_id": c["id"],
                "correspondente": c["nome"],
                "cnpj": c["cnpj"],
                "tipo": rotulo,
                "data": ultima,
                "pilares": len({r["pilar"] for r in na_data}),
                "media": round(sum(notas) / len(notas), 2) if notas else None,
            })
    return pd.DataFrame(linhas)


def formulario_auditoria(sb) -> None:
    st.subheader("Registrar resultado de auditoria")
    st.caption(
        "Entrada manual por pilar (FR-3). A pontuação do pilar é a média dos "
        "subcritérios avaliados (ok=100, parcial=50, não ok=0). Isso ainda "
        "não dispara a classificação anual do Quadro 3."
    )
    correspondentes = (
        sb.table("correspondentes").select("id, nome, cnpj").order("nome").execute().data
    )
    if not correspondentes:
        st.info("Nenhum correspondente cadastrado. Rode o ETL de reclamações primeiro.")
        return

    tipo_chave = st.selectbox(
        "Tipo",
        list(TIPOS_AUDITORIA.keys()),
        format_func=lambda k: TIPOS_AUDITORIA[k][1],
    )
    corr = st.selectbox("Correspondente", correspondentes, format_func=_rotulo_corr)
    pilar_chave = st.selectbox(
        "Pilar",
        list(PILARES.keys()),
        format_func=lambda k: PILARES[k],
    )
    data_av = st.date_input("Data da avaliação", value=date.today())

    st.markdown("**Subcritérios**")
    subcriterios: dict[str, str] = {}
    opcoes = list(ROTULOS_NOTA.keys())
    for chave, rotulo in SUBCRITERIOS[pilar_chave].items():
        subcriterios[chave] = st.radio(
            rotulo,
            opcoes,
            format_func=lambda v: ROTULOS_NOTA[v],
            horizontal=True,
            key=f"sub_{pilar_chave}_{chave}",
            index=3,  # nao_avaliado
        )
    pontuacao = pontuacao_pilar(subcriterios)
    if pontuacao is None:
        st.info("Nenhum subcritério avaliado — a pontuação do pilar ficará em branco.")
    else:
        st.metric("Pontuação do pilar", f"{pontuacao:.0f}")

    observacoes = st.text_area("Observações (auditável)")
    if st.button("Gravar auditoria", type="primary"):
        tabela = TIPOS_AUDITORIA[tipo_chave][0]
        sb.table(tabela).insert({
            "correspondente_id": corr["id"],
            "pilar": pilar_chave,
            "pontuacao": pontuacao,
            "subcriterios": subcriterios,
            "data_avaliacao": data_av.isoformat(),
            "observacoes": observacoes or None,
        }).execute()
        st.success(f"{TIPOS_AUDITORIA[tipo_chave][1]} gravada: {PILARES[pilar_chave]}.")

    _historico(sb)


def _historico(sb) -> None:
    st.markdown("**Últimos registros**")
    blocos = []
    for chave, (tabela, rotulo) in TIPOS_AUDITORIA.items():
        rows = (
            sb.table(tabela)
            .select(
                "data_avaliacao, pilar, pontuacao, observacoes, correspondentes(nome)"
            )
            .order("data_avaliacao", desc=True)
            .limit(15)
            .execute()
            .data
            or []
        )
        for r in rows:
            blocos.append({
                "Tipo": rotulo,
                "Data": r["data_avaliacao"],
                "Correspondente": (r.get("correspondentes") or {}).get("nome") or "—",
                "Pilar": PILARES.get(r["pilar"], r["pilar"]),
                "Pontuação": r["pontuacao"] if r["pontuacao"] is not None else "—",
                "Observações": r.get("observacoes") or "—",
            })
    if not blocos:
        st.caption("Nenhuma auditoria registrada ainda.")
        return
    hist = pd.DataFrame(blocos).sort_values("Data", ascending=False).head(20)
    st.dataframe(hist, use_container_width=True, hide_index=True)
