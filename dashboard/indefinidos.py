"""Fila operacional: confirmar reclamações/ações com responsável indefinido.

O Navigate entrega ~25% dos casos como Indefinido (export detalhado sem par
na normal do mês). A área confirma Corban ou Senff; o parecer original não
vira procedente só por causa da confirmação. O motor só conta Corban +
parecer que começa com 'procedente'.
"""

from __future__ import annotations

from datetime import date, datetime

TABELAS_INDEFINIDOS = ("reclamacoes", "acoes_judiciais")


def para_date(valor) -> date:
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    return date.fromisoformat(str(valor)[:10])


def sufixo_confirmacao(parecer: str | None, destino: str, hoje: date | None = None) -> str:
    """Acrescenta trilha de auditoria sem alterar o texto do parecer original."""
    if destino not in ("corban", "senff"):
        raise ValueError("destino deve ser corban ou senff")
    dia = (hoje or date.today()).isoformat()
    extra = f"[V1: confirmado {destino} em {dia}]"
    base = (parecer or "").strip()
    if extra in base:
        return base
    if not base:
        return extra
    return f"{base} {extra}"


def payload_confirmacao(parecer: str | None, destino: str, hoje: date | None = None) -> dict:
    return {
        "responsavel": destino,
        "parecer": sufixo_confirmacao(parecer, destino, hoje),
    }


def log_confirmacao(
    tabela: str,
    registro_id: str,
    destino: str,
    usuario_id: str | None,
    parecer_anterior: str | None,
    parecer_novo: str,
) -> dict:
    """Uma linha no schema V1 de log_alteracoes (jsonb antigos/novos)."""
    return {
        "tabela_afetada": tabela,
        "registro_id": registro_id,
        "operacao": "update",
        "dados_antigos": {"responsavel": "indefinido", "parecer": parecer_anterior},
        "dados_novos": {"responsavel": destino, "parecer": parecer_novo},
        "usuario_id": usuario_id,
    }


def _rotulo_correspondente(mapa: dict, cid: str | None) -> str:
    if not cid:
        return "—"
    row = mapa.get(cid) or {}
    return row.get("nome") or cid[:8]


def carregar_indefinidos(sb, mes: str | None = None) -> list[dict]:
    """Lista casos indefinidos sem CPF (LGPD). Filtra por mes_referencia."""
    ids: set[str] = set()
    linhas: list[dict] = []
    for tabela in TABELAS_INDEFINIDOS:
        campos = "id, correspondente_id, protocolo, mes_referencia, data_encerramento, parecer, responsavel"
        if tabela == "reclamacoes":
            campos += ", canal_origem"
        q = sb.table(tabela).select(campos).eq("responsavel", "indefinido")
        if mes:
            q = q.eq("mes_referencia", str(mes)[:10])
        data = q.order("mes_referencia", desc=True).execute().data or []
        for row in data:
            cid = row.get("correspondente_id")
            if cid:
                ids.add(cid)
            linhas.append(
                {
                    "tabela": tabela,
                    "id": row["id"],
                    "correspondente_id": cid,
                    "protocolo": row.get("protocolo") or "—",
                    "ano_mes": row.get("mes_referencia"),
                    "encerrado_em": row.get("data_encerramento"),
                    "canal": row.get("canal_origem") or "—",
                    "parecer": row.get("parecer"),
                    "fonte": "reclamações" if tabela == "reclamacoes" else "ações judiciais",
                }
            )
    mapa: dict = {}
    if ids:
        cors = (
            sb.table("correspondentes")
            .select("id, nome")
            .in_("id", list(ids))
            .execute()
            .data
            or []
        )
        mapa = {c["id"]: c for c in cors}
    for row in linhas:
        row["correspondente"] = _rotulo_correspondente(mapa, row.get("correspondente_id"))
    return linhas


def confirmar_indefinido(sb, registro: dict, destino: str, usuario_id: str | None) -> dict:
    """Atribui Corban/Senff, grava log e reclassifica o mês do caso."""
    from etl.etl_reclamacoes import reclassificar_mes

    if destino not in ("corban", "senff"):
        raise ValueError("destino deve ser corban ou senff")
    payload = payload_confirmacao(registro.get("parecer"), destino)
    sb.table(registro["tabela"]).update(payload).eq("id", registro["id"]).execute()
    try:
        sb.table("log_alteracoes").insert(
            log_confirmacao(
                registro["tabela"],
                registro["id"],
                destino,
                usuario_id,
                registro.get("parecer"),
                payload["parecer"],
            )
        ).execute()
    except Exception:
        # A atribuição e a reclassificação não dependem do log.
        pass
    reclassificar_mes(sb, para_date(registro["ano_mes"]))
    return payload


def render_fila_indefinidos(st, sb, usuario_id: str | None, eh_staff: bool) -> None:
    st.subheader("Fila de indefinidos")
    st.caption(
        "O Navigate marca ~25% dos casos como Indefinido (abertos em meses "
        "anteriores, encerrados neste). Confirme Corban ou Senff sem inventar "
        "procedente: o motor só conta Corban + parecer procedente."
    )
    todos = carregar_indefinidos(sb)
    meses = sorted(
        {str(r["ano_mes"])[:10] for r in todos if r.get("ano_mes")},
        reverse=True,
    )
    if not meses:
        st.success("Nenhum caso indefinido na base.")
        return
    mes = st.selectbox("Mês da fila", meses, key="fila_indef_mes")
    filas = [r for r in todos if str(r.get("ano_mes") or "")[:10] == mes]
    st.metric("Indefinidos neste mês", len(filas))
    if not filas:
        st.info("Nada pendente neste mês.")
        return

    st.dataframe(
        [
            {
                "fonte": r["fonte"],
                "protocolo": r["protocolo"],
                "correspondente": r["correspondente"],
                "canal": r["canal"],
                "encerrado_em": r["encerrado_em"] or "—",
                "parecer": (r["parecer"] or "—")[:120],
            }
            for r in filas
        ],
        use_container_width=True,
        hide_index=True,
    )

    if not eh_staff:
        st.caption("Somente a área de Qualidade confirma a atribuição.")
        return

    opcoes = {
        f"{r['fonte']} · {r['protocolo']} · {r['correspondente']}": r for r in filas
    }
    escolhido = st.selectbox("Caso a confirmar", list(opcoes), key="fila_indef_caso")
    registro = opcoes[escolhido]
    destino = st.radio(
        "Atribuir a",
        ["corban", "senff"],
        format_func=lambda x: "Correspondente (Corban)" if x == "corban" else "Senff",
        horizontal=True,
        key="fila_indef_destino",
    )
    st.caption(f"Parecer atual: {registro.get('parecer') or '—'}")
    if st.button("Confirmar atribuição e reclassificar o mês", type="primary", key="fila_indef_btn"):
        try:
            confirmar_indefinido(sb, registro, destino, usuario_id)
            st.success(
                f"Protocolo {registro['protocolo']} → {destino}. "
                f"Mês {str(registro['ano_mes'])[:7]} reclassificado."
            )
            st.rerun()
        except Exception as exc:
            st.error(f"Não foi possível confirmar: {exc}")
