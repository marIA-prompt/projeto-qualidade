"""Painel do Plano de Qualidade de Correspondentes — V1 (FR-5, FR-6, FR-11).

Autenticação via Supabase Auth (anon key). Todas as consultas rodam com o
token do usuário logado, então o RLS do Postgres é respeitado normalmente:
usuários "staff" enxergam tudo; usuários "correspondente" enxergam apenas o
próprio correspondente. NUNCA use a service_role key aqui.

Toda a lógica de negócio (índice, corte, status) mora no ETL e no
motor_classificacao — este app apenas exibe o que está gravado no banco e
registra atos manuais (medida administrativa aplicada, FR-11).

Rodar:  streamlit run dashboard/app.py
"""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

import pandas as pd
import streamlit as st
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

st.set_page_config(page_title="Plano de Qualidade de Correspondentes", layout="wide")

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

def tela_login() -> None:
    st.title("Plano de Qualidade de Correspondentes")
    st.caption("Banco Senff — Autorregulação do Crédito Consignado (FEBRABAN)")
    with st.form("login"):
        email = st.text_input("E-mail")
        senha = st.text_input("Senha", type="password")
        if st.form_submit_button("Entrar", type="primary"):
            try:
                resposta = _cliente_base().auth.sign_in_with_password(
                    {"email": email, "password": senha}
                )
            except Exception:
                st.error("E-mail ou senha inválidos.")
                return
            st.session_state["sessao"] = {
                "access_token": resposta.session.access_token,
                "user_id": resposta.user.id,
                "email": resposta.user.email,
            }
            st.rerun()


def carregar_perfil(sb) -> dict | None:
    dados = (
        sb.table("perfis")
        .select("papel, correspondente_id")
        .eq("user_id", st.session_state["sessao"]["user_id"])
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


def classificacoes_do_mes(sb, mes: str) -> pd.DataFrame:
    dados = (
        sb.table("classificacoes_mensais")
        .select("*, correspondentes(nome, cnpj)")
        .eq("mes_referencia", mes)
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
    return df.sort_values("numerador", ascending=False)


# ---------------------------------------------------------------------------
# Componentes
# ---------------------------------------------------------------------------

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
        "Carteira produzida": df["denominador"],
        "Índice": df["indice"].map(
            lambda v: f"{float(v) * 100:.4f}%" if pd.notna(v) else "—"
        ),
        "Status": df["status"].map(ROTULOS_STATUS),
        "Ocorrência mais frequente": df["tipo_ocorrencia_mais_frequente"].fillna("—"),
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


def formulario_medida_aplicada(sb, df_mes: pd.DataFrame, mes: str) -> None:
    """FR-11: registro manual da medida administrativa (ato humano, nunca automático)."""
    st.subheader("Registrar medida administrativa aplicada")
    st.caption(
        "Escala interna do Banco Senff (6 níveis). A decisão de qual nível "
        "aplicar é sempre da Gestora de Qualidade — o sistema apenas registra."
    )
    medidas = sb.table("medidas_administrativas").select("*").order("nivel").execute().data
    correspondentes = (
        sb.table("correspondentes").select("id, nome, cnpj").order("nome").execute().data
    )
    if not medidas or not correspondentes:
        st.info("Cadastre correspondentes e rode o schema para habilitar este formulário.")
        return

    with st.form("medida_aplicada"):
        corr = st.selectbox(
            "Correspondente",
            correspondentes,
            format_func=lambda c: f"{c['nome']} ({c['cnpj']})",
        )
        medida = st.selectbox(
            "Medida (nível)",
            medidas,
            format_func=lambda m: f"Nível {m['nivel']} — {m['descricao']}",
        )
        aplicada_em = st.date_input("Data de aplicação", value=date.today())
        motivo = st.text_area("Motivo / contexto (auditável)")
        if st.form_submit_button("Registrar", type="primary"):
            sb.table("medidas_aplicadas").insert({
                "correspondente_id": corr["id"],
                "medida_id": medida["id"],
                "mes_referencia": mes,
                "aplicada_em": aplicada_em.isoformat(),
                "motivo": motivo or None,
            }).execute()
            st.success("Medida registrada com sucesso (gravada na trilha de auditoria).")

    aplicadas = (
        sb.table("medidas_aplicadas")
        .select("aplicada_em, motivo, correspondentes(nome), medidas_administrativas(nivel, descricao)")
        .order("aplicada_em", desc=True)
        .limit(20)
        .execute()
        .data
    )
    if aplicadas:
        st.markdown("**Últimas medidas registradas**")
        historico = pd.DataFrame([{
            "Data": m["aplicada_em"],
            "Correspondente": m["correspondentes"]["nome"],
            "Medida": f"Nível {m['medidas_administrativas']['nivel']} — "
                      f"{m['medidas_administrativas']['descricao']}",
            "Motivo": m["motivo"] or "—",
        } for m in aplicadas])
        st.dataframe(historico, use_container_width=True, hide_index=True)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

def painel() -> None:
    sb = _cliente_do_usuario()
    perfil = carregar_perfil(sb)
    if not perfil:
        st.error(
            "Seu usuário não tem perfil cadastrado. Peça à equipe de Qualidade "
            "para inserir seu registro na tabela `perfis`."
        )
        if st.button("Sair"):
            st.session_state.clear()
            st.rerun()
        return

    eh_staff = perfil["papel"] == "staff"

    with st.sidebar:
        st.markdown(f"**Usuário:** {st.session_state['sessao']['email']}")
        st.markdown(f"**Papel:** {'Qualidade/Compliance' if eh_staff else 'Correspondente'}")
        if st.button("Sair"):
            st.session_state.clear()
            st.rerun()

    st.title("Plano de Qualidade de Correspondentes")
    st.caption(
        "Indicadores mensais de Reclamações e Ações Judiciais — Quadro 5, "
        "art. 9º do Anexo I (Autorregulação do Crédito Consignado)."
    )

    meses = meses_disponiveis(sb)
    if not meses:
        st.info("Nenhum mês processado ainda. Rode o ETL (etl/etl_reclamacoes.py).")
        return
    mes = st.selectbox("Mês de referência", meses)

    df = classificacoes_do_mes(sb, mes)
    if df.empty:
        st.info("Sem dados para o mês selecionado.")
        return

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Correspondentes", len(df))
    col2.metric("Não conformes", int((df["status"] == "nao_conforme").sum()))
    col3.metric("Não aplicáveis", int((df["status"] == "nao_aplicavel").sum()))
    col4.metric("Pendências indefinidas", int(df["qtd_indefinidas"].sum()))

    if int(df["qtd_indefinidas"].sum()) > 0:
        st.warning(
            "Há ocorrências sem atribuição Corban/Senff (encerradas neste mês, mas "
            "abertas em meses anteriores). Elas NÃO entram no índice até confirmação manual."
        )
    if (df["denominador"].isna()).any():
        st.warning(
            "Correspondentes sem carteira produzida carregada ficam como 'não aplicável'. "
            "Carregue a tabela carteira_produzida e rode o ETL novamente."
        )

    tabela_indicadores(df)
    st.subheader("Ocorrências por correspondente")
    grafico_ocorrencias(df)

    if eh_staff:
        st.divider()
        formulario_medida_aplicada(sb, df, mes)


if "sessao" not in st.session_state:
    tela_login()
else:
    painel()
