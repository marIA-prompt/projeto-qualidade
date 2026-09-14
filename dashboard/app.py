"""Painel do Plano de Qualidade de Correspondentes — V1 (FR-5, FR-6, FR-11).

Autenticação via Supabase Auth (anon key). Todas as consultas rodam com o
token do usuário logado, então o RLS do Postgres é respeitado normalmente:
usuários "staff" enxergam tudo; usuários "correspondente" enxergam apenas o
próprio correspondente. NUNCA use a service_role key aqui.

Toda a lógica de negócio (índice, corte, status) mora no ETL e no
motor_classificacao — este app apenas exibe o que está gravado no banco e
registra atos manuais (medida administrativa aplicada, FR-11).

Colunas seguem o schema V1 já aplicado no Supabase (ver supabase_schema_rls.sql).

Rodar:  streamlit run dashboard/app.py
"""

from __future__ import annotations

import os
import sys
from datetime import date
from pathlib import Path

import pandas as pd
import streamlit as st
from dotenv import load_dotenv
from supabase import create_client

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from alertas import avaliar_painel
from auditorias_ui import formulario_auditoria, resumo_auditorias
from tema import LOGO_NAVY, aplicar_tema, cabecalho, hero_login, logo_sidebar, render_kpis
from visoes import (
    aba_alertas_relatorios,
    aba_evolucao,
    aba_por_correspondente,
    aba_relacionamento,
    requisitos_bruna,
)

EMAIL_STAFF_PADRAO = "maria.morais@senff.com.br"

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

st.set_page_config(
    page_title="Plano de Qualidade · Banco Senff",
    page_icon=str(LOGO_NAVY) if LOGO_NAVY.exists() else "🏦",
    layout="wide",
    initial_sidebar_state="expanded",
)

ROTULOS_STATUS = {
    "conforme": "🟢 Conforme",
    "nao_conforme": "🔴 Não conforme",
    "nao_aplicavel": "⚪ Não aplicável",
}


@st.cache_resource
def _cliente_base():
    url = os.environ.get("SUPABASE_URL")
    anon = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not anon:
        st.error("Configure SUPABASE_URL e SUPABASE_ANON_KEY no .env (ver .env.example).")
        st.stop()
    return create_client(url, anon)


def _cliente_do_usuario():
    """Cliente PostgREST autenticado com o token do usuário -> RLS ativo."""
    sb = _cliente_base()
    sessao = st.session_state.get("sessao")
    if sessao:
        sb.postgrest.auth(sessao["access_token"])
    return sb


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def _entrar(email: str, senha: str) -> bool:
    try:
        resposta = _cliente_base().auth.sign_in_with_password(
            {"email": email, "password": senha}
        )
    except Exception:
        return False
    if not resposta.session or not resposta.user:
        return False
    st.session_state["sessao"] = {
        "access_token": resposta.session.access_token,
        "user_id": resposta.user.id,
        "email": resposta.user.email,
    }
    return True


def _autologin_preview() -> None:
    """Login automático só se DASHBOARD_PREVIEW_AUTOLOGIN=1 no .env local."""
    if os.environ.get("DASHBOARD_PREVIEW_AUTOLOGIN") != "1":
        return
    email = os.environ.get("DASHBOARD_PREVIEW_EMAIL")
    senha = os.environ.get("DASHBOARD_PREVIEW_PASSWORD")
    if email and senha and _entrar(email, senha):
        st.rerun()


def tela_login() -> None:
    aplicar_tema(esconder_sidebar=True)
    _autologin_preview()
    _c1, centro, _c3 = st.columns([1, 1.15, 1])
    with centro:
        hero_login()
        with st.form("login"):
            email = st.text_input("E-mail", value=EMAIL_STAFF_PADRAO)
            senha = st.text_input("Senha", type="password")
            if st.form_submit_button("Entrar", type="primary"):
                if _entrar(email, senha):
                    st.rerun()
                else:
                    st.error("E-mail ou senha inválidos.")
        st.caption("Acesso interno · Qualidade e Compliance · Banco Senff")


def carregar_perfil(sb) -> dict | None:
    dados = (
        sb.table("perfis")
        .select("role, correspondente_id")
        .eq("id", st.session_state["sessao"]["user_id"])
        .execute()
        .data
    )
    return dados[0] if dados else None


# ---------------------------------------------------------------------------
# Consultas (o RLS decide o que cada papel enxerga)
# ---------------------------------------------------------------------------

def meses_disponiveis(sb) -> list[str]:
    dados = sb.table("classificacoes_mensais").select("mes_referencia").execute().data
    return sorted({d["mes_referencia"] for d in dados}, reverse=True)


def _moda(series: pd.Series) -> str | None:
    validos = series.dropna()
    if validos.empty:
        return None
    return validos.mode().iloc[0]


def _mes_iso(valor) -> str:
    return str(valor)[:10]


def _contagens_agrupadas(sb) -> pd.DataFrame:
    """Totais por correspondente e mês — base da série histórica."""
    rec = (
        sb.table("reclamacoes")
        .select("correspondente_id, mes_referencia, responsavel, canal_origem")
        .execute()
        .data
        or []
    )
    aj = (
        sb.table("acoes_judiciais")
        .select("correspondente_id, mes_referencia, responsavel")
        .execute()
        .data
        or []
    )
    rec_df = pd.DataFrame(rec)
    aj_df = pd.DataFrame(aj)
    if rec_df.empty and aj_df.empty:
        return pd.DataFrame(columns=[
            "correspondente_id", "mes_referencia", "qtd_reclamacoes",
            "qtd_acoes_judiciais", "qtd_indefinidas", "canal_mais_frequente",
        ])

    chaves: set[tuple[str, str]] = set()
    if not rec_df.empty:
        rec_df["mes_referencia"] = rec_df["mes_referencia"].map(_mes_iso)
        chaves.update(zip(rec_df["correspondente_id"], rec_df["mes_referencia"]))
    if not aj_df.empty:
        aj_df["mes_referencia"] = aj_df["mes_referencia"].map(_mes_iso)
        chaves.update(zip(aj_df["correspondente_id"], aj_df["mes_referencia"]))

    linhas = []
    for corr_id, mes in chaves:
        r = rec_df[(rec_df["correspondente_id"] == corr_id) & (rec_df["mes_referencia"] == mes)] if not rec_df.empty else rec_df
        a = aj_df[(aj_df["correspondente_id"] == corr_id) & (aj_df["mes_referencia"] == mes)] if not aj_df.empty else aj_df
        indefinidas = 0
        if not r.empty:
            indefinidas += int((r["responsavel"] == "indefinido").sum())
        if not a.empty:
            indefinidas += int((a["responsavel"] == "indefinido").sum())
        linhas.append({
            "correspondente_id": corr_id,
            "mes_referencia": mes,
            "qtd_reclamacoes": 0 if r.empty else len(r),
            "qtd_acoes_judiciais": 0 if a.empty else len(a),
            "qtd_indefinidas": indefinidas,
            "canal_mais_frequente": None if r.empty else _moda(r["canal_origem"]),
        })
    return pd.DataFrame(linhas)


def _contagens_do_mes(sb, mes: str) -> pd.DataFrame:
    extra = _contagens_agrupadas(sb)
    if extra.empty:
        return extra
    alvo = _mes_iso(mes)
    return extra[extra["mes_referencia"] == alvo].drop(columns=["mes_referencia"])


def classificacoes_historico(sb) -> pd.DataFrame:
    dados = (
        sb.table("classificacoes_mensais")
        .select("*, correspondentes(nome, cnpj)")
        .execute()
        .data
    )
    if not dados:
        return pd.DataFrame()
    df = pd.json_normalize(dados)
    df = df.rename(columns={
        "correspondentes.nome": "correspondente",
        "correspondentes.cnpj": "cnpj",
    })
    df["mes_referencia"] = df["mes_referencia"].map(_mes_iso)
    extra = _contagens_agrupadas(sb)
    if extra.empty:
        df["qtd_reclamacoes"] = 0
        df["qtd_acoes_judiciais"] = 0
        df["qtd_indefinidas"] = 0
        df["canal_mais_frequente"] = None
    else:
        df = df.merge(extra, on=["correspondente_id", "mes_referencia"], how="left")
        df["qtd_reclamacoes"] = df["qtd_reclamacoes"].fillna(0).astype(int)
        df["qtd_acoes_judiciais"] = df["qtd_acoes_judiciais"].fillna(0).astype(int)
        df["qtd_indefinidas"] = df["qtd_indefinidas"].fillna(0).astype(int)
    df["numerador"] = (
        df["qtd_reclamacoes_corban"].fillna(0) + df["qtd_acoes_judiciais_corban"].fillna(0)
    )
    return df


def classificacoes_do_mes(hist: pd.DataFrame, mes: str) -> pd.DataFrame:
    if hist.empty or not mes:
        return pd.DataFrame()
    alvo = _mes_iso(mes)
    df = hist[hist["mes_referencia"] == alvo]
    if df.empty:
        return df
    return df.sort_values("numerador", ascending=False)


# ---------------------------------------------------------------------------
# Componentes
# ---------------------------------------------------------------------------

def _kpis_do_mes(df: pd.DataFrame, resumo: pd.DataFrame) -> list[dict]:
    rec = int(df["qtd_reclamacoes"].sum())
    rec_corban = int(df["qtd_reclamacoes_corban"].fillna(0).sum())
    aj = int(df["qtd_acoes_judiciais"].sum())
    aj_corban = int(df["qtd_acoes_judiciais_corban"].fillna(0).sum())
    indefinidas = int(df["qtd_indefinidas"].sum())
    if resumo.empty:
        ext = 0
        inte = 0
    else:
        ext = int(resumo.loc[resumo["tipo"] == "Auditoria externa", "data"].notna().sum())
        inte = int(resumo.loc[resumo["tipo"] == "Auditoria interna", "data"].notna().sum())
    return [
        {
            "label": "1. Reclamações",
            "value": str(rec),
            "hint": f"{rec_corban} procedentes-Corban",
            "tone": "acqua",
        },
        {
            "label": "2. Ações judiciais",
            "value": str(aj),
            "hint": f"{aj_corban} procedentes-Corban",
            "tone": "navy",
        },
        {
            "label": "3–4. Auditorias",
            "value": f"{ext + inte}",
            "hint": f"{ext} externas · {inte} internas com registro",
            "tone": "sky",
        },
        {
            "label": "Pendências",
            "value": str(indefinidas),
            "hint": "sem atribuição Corban/Senff",
            "tone": "warn" if indefinidas else "ok",
        },
    ]


def tabela_quatro_indicadores(df_mes: pd.DataFrame, resumo: pd.DataFrame) -> None:
    """Os 4 indicadores obrigatórios (art. 51) por correspondente."""
    if resumo.empty:
        ext = pd.DataFrame(columns=["correspondente_id", "data", "media", "pilares"])
        inte = ext.copy()
    else:
        ext = resumo[resumo["tipo"] == "Auditoria externa"][
            ["correspondente_id", "data", "media", "pilares"]
        ].rename(columns={"data": "ext_data", "media": "ext_media", "pilares": "ext_pilares"})
        inte = resumo[resumo["tipo"] == "Auditoria interna"][
            ["correspondente_id", "data", "media", "pilares"]
        ].rename(columns={"data": "int_data", "media": "int_media", "pilares": "int_pilares"})

    base = df_mes.merge(ext, on="correspondente_id", how="left").merge(
        inte, on="correspondente_id", how="left"
    )
    for col in ("ext_data", "ext_media", "ext_pilares", "int_data", "int_media", "int_pilares"):
        if col not in base.columns:
            base[col] = None

    def _aud(data, media, pilares):
        if pd.isna(data) or not data:
            return "Sem registro"
        media_txt = f"{float(media):.0f}" if pd.notna(media) else "—"
        return f"{data} · {int(pilares or 0)}/5 pilares · média {media_txt}"

    exibicao = pd.DataFrame({
        "Correspondente": base["correspondente"],
        "CNPJ": base["cnpj"],
        "1. Reclamações": base.apply(
            lambda r: f"{int(r['qtd_reclamacoes'])} "
                      f"({int(r['qtd_reclamacoes_corban'])} proc.-Corban)",
            axis=1,
        ),
        "2. Ações judiciais": base.apply(
            lambda r: f"{int(r['qtd_acoes_judiciais'])} "
                      f"({int(r['qtd_acoes_judiciais_corban'])} proc.-Corban)",
            axis=1,
        ),
        "3. Auditoria externa": [
            _aud(d, m, p) for d, m, p in zip(
                base["ext_data"], base["ext_media"], base["ext_pilares"]
            )
        ],
        "4. Auditoria interna": [
            _aud(d, m, p) for d, m, p in zip(
                base["int_data"], base["int_media"], base["int_pilares"]
            )
        ],
        "Status mensal (Quadro 5)": base["status"].map(ROTULOS_STATUS),
    })
    st.dataframe(exibicao, use_container_width=True, hide_index=True)
    st.caption(
        "Auditorias: última data de avaliação e média dos pilares gravados nesse dia. "
        "A classificação anual (Quadro 3) ainda não é calculada automaticamente."
    )


def tabela_indicadores(df: pd.DataFrame) -> None:
    exibicao = pd.DataFrame({
        "Correspondente": df["correspondente"],
        "CNPJ": df["cnpj"],
        "Reclamações": df["qtd_reclamacoes"],
        "Reclamações proc.-Corban": df["qtd_reclamacoes_corban"],
        "Ações judiciais": df["qtd_acoes_judiciais"],
        "Ações proc.-Corban": df["qtd_acoes_judiciais_corban"],
        "Indefinidas (pendentes)": df["qtd_indefinidas"],
        "Numerador (Quadro 5)": df["numerador"],
        "Carteira produzida": df["carteira_denominador"],
        "Índice": df["indice"].map(
            lambda v: f"{float(v) * 100:.4f}%" if pd.notna(v) else "—"
        ),
        "Status": df["status"].map(ROTULOS_STATUS),
        "Canal mais frequente": df["canal_mais_frequente"].fillna("—"),
    })
    st.dataframe(exibicao, use_container_width=True, hide_index=True)


def grafico_ocorrencias(df: pd.DataFrame) -> None:
    grafico = (
        df.set_index("correspondente")[["qtd_reclamacoes", "qtd_acoes_judiciais"]]
        .rename(columns={
            "qtd_reclamacoes": "Reclamações",
            "qtd_acoes_judiciais": "Ações judiciais",
        })
    )
    st.bar_chart(grafico)


def _rotulo_medida(m: dict) -> str:
    descricao = m.get("descricao") or "—"
    if m.get("nivel"):
        return f"Nível {m['nivel']} — {descricao}"
    if m.get("descricao"):
        return f"{descricao} (discricionária)"
    return descricao


def formulario_medida_aplicada(sb, df_mes: pd.DataFrame, mes: str) -> None:
    """FR-11: registro manual da medida administrativa (ato humano, nunca automático)."""
    st.subheader("Registrar medida administrativa aplicada")
    st.caption(
        "Escala interna do Banco Senff (6 níveis + medidas discricionárias). "
        "A decisão de qual medida aplicar é sempre da Gestora de Qualidade — "
        "o sistema apenas registra."
    )
    medidas = sb.table("medidas_administrativas").select("*").order("id").execute().data
    correspondentes = (
        sb.table("correspondentes").select("id, nome, cnpj").order("nome").execute().data
    )
    if not medidas or not correspondentes:
        st.info("Cadastre correspondentes para habilitar este formulário.")
        return

    with st.form("medida_aplicada"):
        corr = st.selectbox(
            "Correspondente",
            correspondentes,
            format_func=lambda c: f"{c['nome']} ({c['cnpj']})",
        )
        medida = st.selectbox(
            "Medida",
            medidas,
            format_func=_rotulo_medida,
        )
        aplicada_em = st.date_input("Data de aplicação", value=date.today())
        motivo = st.text_area("Motivo / contexto (auditável)")
        if st.form_submit_button("Registrar", type="primary"):
            classif_id = None
            if not df_mes.empty and "id" in df_mes.columns:
                match = df_mes[df_mes["correspondente_id"] == corr["id"]]
                if not match.empty:
                    classif_id = match.iloc[0]["id"]
            sb.table("medidas_aplicadas").insert({
                "correspondente_id": corr["id"],
                "medida_id": medida["id"],
                "classificacao_mensal_id": classif_id,
                "data_aplicacao": aplicada_em.isoformat(),
                "aplicada_por": st.session_state["sessao"]["user_id"],
                "motivo": motivo or None,
            }).execute()
            st.success("Medida registrada com sucesso.")

    aplicadas = (
        sb.table("medidas_aplicadas")
        .select(
            "data_aplicacao, motivo, correspondentes(nome), "
            "medidas_administrativas(nivel, descricao)"
        )
        .order("data_aplicacao", desc=True)
        .limit(20)
        .execute()
        .data
    )
    if aplicadas:
        st.markdown("**Últimas medidas registradas**")
        historico = pd.DataFrame([{
            "Data": m["data_aplicacao"],
            "Correspondente": (m.get("correspondentes") or {}).get("nome") or "—",
            "Medida": _rotulo_medida(m.get("medidas_administrativas") or {}),
            "Motivo": m["motivo"] or "—",
        } for m in aplicadas])
        st.dataframe(historico, use_container_width=True, hide_index=True)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

def painel() -> None:
    aplicar_tema()
    sb = _cliente_do_usuario()
    perfil = carregar_perfil(sb)
    if not perfil:
        st.error(
            "Seu usuário não tem perfil cadastrado. Peça à equipe de Qualidade "
            "para inserir seu registro na tabela `perfis` "
            "(colunas: id = auth.uid(), role = 'staff' ou 'correspondente')."
        )
        if st.button("Sair"):
            st.session_state.clear()
            st.rerun()
        return

    eh_staff = perfil["role"] == "staff"
    logo_sidebar()

    with st.sidebar:
        st.markdown("**Qualidade de Correspondentes**")
        st.caption(st.session_state["sessao"]["email"])
        st.caption("Qualidade/Compliance" if eh_staff else "Correspondente")
        if st.button("Sair"):
            st.session_state.clear()
            st.rerun()

    cabecalho(
        "Autorregulação do Crédito Consignado — 4 indicadores obrigatórios "
        "(Reclamações, Ações Judiciais, Auditorias Externas e Internas)."
    )
    requisitos_bruna()

    hist = classificacoes_historico(sb)
    meses = sorted(hist["mes_referencia"].unique(), reverse=True) if not hist.empty else []
    mes = st.selectbox("Mês de referência", meses) if meses else None
    df = classificacoes_do_mes(hist, mes) if mes else pd.DataFrame()
    resumo = resumo_auditorias(sb)
    alertas = avaliar_painel(df, resumo, mes or "")

    if not df.empty:
        render_kpis(_kpis_do_mes(df, resumo))

    (
        tab_quatro,
        tab_corr,
        tab_evo,
        tab_alertas,
        tab_rel,
        tab_mensal,
        tab_aud,
        tab_med,
    ) = st.tabs([
        "4 indicadores",
        "Por correspondente",
        "Evolução",
        "Alertas e relatórios",
        "Relacionamento",
        "Fechamento mensal",
        "Auditorias",
        "Medidas administrativas",
    ])

    with tab_quatro:
        if df.empty:
            st.info("Nenhum mês processado ainda. Rode o ETL de reclamações.")
        else:
            st.markdown(
                '<p class="pq-legend">'
                '<span class="pq-chip pq-chip--ok">Conforme &lt; 0,03%</span>'
                '<span class="pq-chip pq-chip--danger">Não conforme ≥ 0,03%</span>'
                '<span class="pq-chip pq-chip--off">Não aplicável — sem carteira</span>'
                "</p>",
                unsafe_allow_html=True,
            )
            tabela_quatro_indicadores(df, resumo)

    with tab_corr:
        aba_por_correspondente(df, hist, resumo, alertas, mes or "")

    with tab_evo:
        aba_evolucao(hist)

    with tab_alertas:
        aba_alertas_relatorios(sb, df, alertas, mes or "", eh_staff)

    with tab_rel:
        aba_relacionamento(df, alertas, resumo)

    with tab_mensal:
        if df.empty:
            st.info("Nenhum mês processado ainda. Rode o ETL de reclamações.")
        else:
            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Correspondentes", len(df))
            col2.metric("Não conformes", int((df["status"] == "nao_conforme").sum()))
            col3.metric("Não aplicáveis", int((df["status"] == "nao_aplicavel").sum()))
            col4.metric("Pendências indefinidas", int(df["qtd_indefinidas"].sum()))
            if int(df["qtd_indefinidas"].sum()) > 0:
                st.warning(
                    "Há ocorrências sem atribuição Corban/Senff (encerradas neste mês, "
                    "mas abertas em meses anteriores). Elas NÃO entram no índice até "
                    "confirmação manual."
                )
            if df["carteira_denominador"].isna().any():
                st.info(
                    "Sem carteira produzida o status mensal fica 'não aplicável'. "
                    "A planilha de volumetria fica para quando a fonte estiver disponível."
                )
            tabela_indicadores(df)
            st.subheader("Ocorrências por correspondente")
            grafico_ocorrencias(df)

    with tab_aud:
        if eh_staff:
            formulario_auditoria(sb)
        else:
            st.caption("Somente a área de Qualidade registra auditorias.")
            if not resumo.empty:
                st.dataframe(
                    resumo[resumo["correspondente_id"] == perfil.get("correspondente_id")][
                        ["tipo", "data", "pilares", "media"]
                    ].rename(columns={
                        "tipo": "Tipo", "data": "Data",
                        "pilares": "Pilares", "media": "Média",
                    }),
                    use_container_width=True,
                    hide_index=True,
                )

    with tab_med:
        if eh_staff:
            formulario_medida_aplicada(sb, df, mes or "")
        else:
            st.caption("Somente a área de Qualidade registra medidas administrativas.")


if "sessao" not in st.session_state:
    tela_login()
else:
    painel()
