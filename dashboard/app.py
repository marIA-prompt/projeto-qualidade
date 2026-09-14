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
from datetime import date
from pathlib import Path

import pandas as pd
import streamlit as st
from dotenv import load_dotenv
from supabase import create_client

from auditorias_ui import formulario_auditoria, resumo_auditorias

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


def _contagens_do_mes(sb, mes: str) -> pd.DataFrame:
    """Totais, indefinidas e canal mais frequente — derivados das ocorrências.

    O schema de classificacoes_mensais só guarda o numerador Corban e o status;
    o restante do painel (FR-5) é lido das tabelas de ocorrência.
    """
    rec = (
        sb.table("reclamacoes")
        .select("correspondente_id, responsavel, canal_origem")
        .eq("mes_referencia", mes)
        .execute()
        .data
        or []
    )
    aj = (
        sb.table("acoes_judiciais")
        .select("correspondente_id, responsavel")
        .eq("mes_referencia", mes)
        .execute()
        .data
        or []
    )
    rec_df = pd.DataFrame(rec)
    aj_df = pd.DataFrame(aj)

    linhas = []
    ids = set()
    if not rec_df.empty:
        ids.update(rec_df["correspondente_id"].tolist())
    if not aj_df.empty:
        ids.update(aj_df["correspondente_id"].tolist())

    for corr_id in ids:
        r = rec_df[rec_df["correspondente_id"] == corr_id] if not rec_df.empty else rec_df
        a = aj_df[aj_df["correspondente_id"] == corr_id] if not aj_df.empty else aj_df
        indefinidas = 0
        if not r.empty:
            indefinidas += int((r["responsavel"] == "indefinido").sum())
        if not a.empty:
            indefinidas += int((a["responsavel"] == "indefinido").sum())
        linhas.append({
            "correspondente_id": corr_id,
            "qtd_reclamacoes": 0 if r.empty else len(r),
            "qtd_acoes_judiciais": 0 if a.empty else len(a),
            "qtd_indefinidas": indefinidas,
            "canal_mais_frequente": None if r.empty else _moda(r["canal_origem"]),
        })
    return pd.DataFrame(linhas)


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
    extra = _contagens_do_mes(sb, mes)
    if extra.empty:
        df["qtd_reclamacoes"] = 0
        df["qtd_acoes_judiciais"] = 0
        df["qtd_indefinidas"] = 0
        df["canal_mais_frequente"] = None
    else:
        df = df.merge(extra, on="correspondente_id", how="left")
        df["qtd_reclamacoes"] = df["qtd_reclamacoes"].fillna(0).astype(int)
        df["qtd_acoes_judiciais"] = df["qtd_acoes_judiciais"].fillna(0).astype(int)
        df["qtd_indefinidas"] = df["qtd_indefinidas"].fillna(0).astype(int)
    df["numerador"] = (
        df["qtd_reclamacoes_corban"].fillna(0) + df["qtd_acoes_judiciais_corban"].fillna(0)
    )
    return df.sort_values("numerador", ascending=False)


# ---------------------------------------------------------------------------
# Componentes
# ---------------------------------------------------------------------------

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

    with st.sidebar:
        st.markdown(f"**Usuário:** {st.session_state['sessao']['email']}")
        st.markdown(f"**Papel:** {'Qualidade/Compliance' if eh_staff else 'Correspondente'}")
        if st.button("Sair"):
            st.session_state.clear()
            st.rerun()

    st.title("Plano de Qualidade de Correspondentes")
    st.caption(
        "Autorregulação do Crédito Consignado — 4 indicadores obrigatórios "
        "(Reclamações, Ações Judiciais, Auditorias Externas e Internas)."
    )

    meses = meses_disponiveis(sb)
    mes = st.selectbox("Mês de referência", meses) if meses else None
    df = classificacoes_do_mes(sb, mes) if mes else pd.DataFrame()
    resumo = resumo_auditorias(sb)

    tab_quatro, tab_mensal, tab_aud, tab_med = st.tabs([
        "4 indicadores",
        "Fechamento mensal",
        "Auditorias",
        "Medidas administrativas",
    ])

    with tab_quatro:
        if df.empty:
            st.info("Nenhum mês processado ainda. Rode o ETL de reclamações.")
        else:
            tabela_quatro_indicadores(df, resumo)

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
