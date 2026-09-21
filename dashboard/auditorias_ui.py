"""UI de auditorias externas/internas (FR-3) — entrada manual por pilar."""

from __future__ import annotations

from datetime import date

import pandas as pd
import streamlit as st

from pilares import PILARES, TIPOS_AUDITORIA, formatar_pontuacao, parse_pontuacao_manual


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
        "Fiel ao relatório oficial: os 5 pilares, as observações da EY e a "
        "pontuação final digitada (ex.: 92%). Sem subcritérios e sem média "
        "automática. A nota entra na pontuação qualitativa do monitoramento anual."
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
        key="aud_tipo",
    )
    corr = st.selectbox(
        "Correspondente",
        correspondentes,
        format_func=_rotulo_corr,
        key="aud_correspondente",
    )
    pilar_chave = st.selectbox(
        "Pilar",
        list(PILARES.keys()),
        format_func=lambda k: PILARES[k],
        key="aud_pilar",
    )
    st.caption("Critério geral do relatório — somente os 5 pilares, sem detalhar subcritério.")
    data_av = st.date_input("Data da avaliação", value=date.today(), key="aud_data")

    observacoes = st.text_area(
        "Observações da EY — Auditoria",
        placeholder="Cole aqui as informações e achados do relatório oficial",
        key="aud_obs",
    )
    pontuacao_txt = st.text_input(
        "Pontuação da auditoria (%)",
        placeholder="Ex.: 92",
        key="aud_pontuacao",
    )
    st.caption(
        "Digite o percentual do relatório (pontuação final). Não calculamos a partir de subcritérios."
    )
    if st.button("Gravar auditoria", type="primary"):
        try:
            pontuacao = parse_pontuacao_manual(pontuacao_txt)
        except ValueError as exc:
            st.error(str(exc))
            _historico(sb)
            return
        tabela = TIPOS_AUDITORIA[tipo_chave][0]
        sb.table(tabela).insert({
            "correspondente_id": corr["id"],
            "pilar": pilar_chave,
            "pontuacao": pontuacao,
            "subcriterios": {},
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
                "Pontuação": formatar_pontuacao(r["pontuacao"]),
                "Observações": r.get("observacoes") or "—",
            })
    if not blocos:
        st.caption("Nenhuma auditoria registrada ainda.")
        return
    hist = pd.DataFrame(blocos).sort_values("Data", ascending=False).head(20)
    st.dataframe(hist, use_container_width=True, hide_index=True)
