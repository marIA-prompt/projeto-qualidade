"""Painel Streamlit — Plano de Qualidade de Correspondentes (V1 / MVP).

Escopo desta fase (ver dashboard/README.md):
    - Login via Supabase Auth.
    - Painel por correspondente com Reclamações e Ações Judiciais
      (total / procedentes-Corban / procedentes-Senff / indefinidas),
      tipo de ocorrência mais frequente e status da classificação mensal.
    - Registro manual da medida administrativa aplicada (FR-11).

Fora de escopo: envio de e-mail, auditorias externas/internas, classificação
anual, Agentes de Crédito (ver docs/decisoes.md).
"""

from __future__ import annotations

from datetime import date

import plotly.express as px
import streamlit as st
from dotenv import load_dotenv

from dashboard.auth import ConfiguracaoAusente, autenticar, obter_client, sair
from dashboard.queries import (
    buscar_classificacoes_mes,
    buscar_ocorrencias_mes,
    buscar_perfil,
    listar_correspondentes,
    listar_medidas_administrativas,
    listar_medidas_aplicadas,
    registrar_medida_aplicada,
)
from dashboard.resumo import formatar_indice_percentual, montar_visao_geral, rotulo_status

load_dotenv()

st.set_page_config(page_title="Plano de Qualidade de Correspondentes", layout="wide")


def tela_login(client) -> None:
    st.title("Plano de Qualidade de Correspondentes")
    st.caption("Autorregulação do Crédito Consignado — acesso via Supabase Auth")

    with st.form("login"):
        email = st.text_input("E-mail")
        senha = st.text_input("Senha", type="password")
        entrar = st.form_submit_button("Entrar")

    if entrar:
        try:
            usuario = autenticar(client, email, senha)
            st.session_state["usuario"] = usuario
            st.rerun()
        except Exception as exc:  # noqa: BLE001 — erro de credencial deve virar mensagem amigável
            st.error(f"Não foi possível autenticar: {exc}")


def formulario_medida_aplicada(client, correspondente_id: str, classificacao_mensal_id: str | None, usuario_id: str) -> None:
    st.subheader("Registrar medida administrativa aplicada (FR-11)")
    st.caption(
        "Escala de 6 níveis do art. 110 do Normativo Correlato. O registro é sempre um ato humano — "
        "o sistema não decide nem sugere automaticamente qual nível aplicar nesta fase."
    )

    medidas = listar_medidas_administrativas(client)
    if medidas.empty:
        st.info("Nenhuma medida administrativa cadastrada em `medidas_administrativas`.")
        return

    opcoes = dict(zip(medidas["descricao"], medidas["id"]))
    with st.form(f"medida_aplicada_{correspondente_id}"):
        descricao_escolhida = st.selectbox("Medida aplicada", list(opcoes.keys()))
        motivo = st.text_input("Motivo (referência ao ciclo/ocorrências)")
        observacoes = st.text_area("Observações")
        confirmar = st.form_submit_button("Registrar medida")

    if confirmar:
        registrar_medida_aplicada(
            client,
            correspondente_id=correspondente_id,
            medida_id=int(opcoes[descricao_escolhida]),
            classificacao_mensal_id=classificacao_mensal_id,
            motivo=motivo,
            observacoes=observacoes,
            aplicada_por=usuario_id,
        )
        st.success("Medida administrativa registrada.")
        st.rerun()

    historico = listar_medidas_aplicadas(client, correspondente_id)
    if not historico.empty:
        st.caption("Histórico de medidas aplicadas a este correspondente")
        st.dataframe(historico[["aplicada_em", "motivo", "observacoes"]], use_container_width=True, hide_index=True)


def painel_detalhe(client, correspondente_id: str, nome: str, mes_referencia: str) -> None:
    reclamacoes = buscar_ocorrencias_mes(client, "reclamacoes", [correspondente_id], mes_referencia)
    acoes = buscar_ocorrencias_mes(client, "acoes_judiciais", [correspondente_id], mes_referencia)
    classificacoes = buscar_classificacoes_mes(client, [correspondente_id], mes_referencia)

    visao = montar_visao_geral({correspondente_id: nome}, reclamacoes, acoes, classificacoes)
    linha = visao.iloc[0]

    st.subheader(f"{nome} — {mes_referencia}")

    colunas = st.columns(4)
    colunas[0].metric("Reclamações (total)", int(linha["reclamacoes_total"]))
    colunas[1].metric("Ações judiciais (total)", int(linha["acoes_total"]))
    colunas[2].metric("Índice (Quadro 5)", linha["indice_formatado"])
    colunas[3].metric("Status", linha["status_formatado"])

    if linha["tipo_mais_frequente"]:
        st.caption(f"Tipo de ocorrência mais frequente: **{linha['tipo_mais_frequente']}**")

    grafico_df = None
    dados_grafico = []
    for categoria, total, procedentes_corban, procedentes_senff, indefinidas in [
        (
            "Reclamações",
            linha["reclamacoes_total"],
            linha["reclamacoes_procedentes_corban"],
            linha["reclamacoes_procedentes_senff"],
            linha["reclamacoes_indefinidas"],
        ),
        (
            "Ações judiciais",
            linha["acoes_total"],
            linha["acoes_procedentes_corban"],
            linha["acoes_procedentes_senff"],
            linha["acoes_indefinidas"],
        ),
    ]:
        dados_grafico.extend(
            [
                {"categoria": categoria, "atribuição": "Procedente - Corban", "quantidade": procedentes_corban},
                {"categoria": categoria, "atribuição": "Procedente - Senff", "quantidade": procedentes_senff},
                {"categoria": categoria, "atribuição": "Indefinida", "quantidade": indefinidas},
                {
                    "categoria": categoria,
                    "atribuição": "Demais (improcedente)",
                    "quantidade": max(total - procedentes_corban - procedentes_senff - indefinidas, 0),
                },
            ]
        )

    import pandas as pd

    grafico_df = pd.DataFrame(dados_grafico)
    if grafico_df["quantidade"].sum() > 0:
        fig = px.bar(
            grafico_df,
            x="categoria",
            y="quantidade",
            color="atribuição",
            barmode="stack",
            title="Reclamações e Ações Judiciais por atribuição de responsabilidade",
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("Sem reclamações ou ações judiciais registradas para este correspondente no mês selecionado.")

    st.caption(
        "Apenas ocorrências 'Procedente - Corban' entram no numerador do índice do Quadro 5 "
        "(art. 53). Ocorrências 'indefinidas' aguardam confirmação manual e não são somadas."
    )


def main() -> None:
    try:
        client = obter_client()
    except ConfiguracaoAusente as exc:
        st.error(str(exc))
        st.stop()
        return

    if "usuario" not in st.session_state:
        st.session_state["usuario"] = None

    if not st.session_state["usuario"]:
        tela_login(client)
        st.stop()
        return

    usuario = st.session_state["usuario"]
    perfil = buscar_perfil(client, usuario.id)

    if perfil is None:
        st.error(
            "Usuário autenticado, mas sem perfil cadastrado em `perfis`. "
            "Peça para a área de Qualidade cadastrar seu papel (staff ou correspondente)."
        )
        if st.button("Sair"):
            sair(client)
            st.rerun()
        st.stop()
        return

    papel = perfil["papel"]

    with st.sidebar:
        st.write(f"Logado como **{usuario.email}**")
        st.write(f"Papel: `{papel}`")
        if st.button("Sair", key="sair"):
            sair(client)
            st.rerun()
        st.divider()
        mes_referencia = st.text_input("Mês de referência (AAAA-MM)", value=date.today().strftime("%Y-%m"))

    st.title("Painel do Plano de Qualidade de Correspondentes")

    if papel == "staff":
        correspondentes_df = listar_correspondentes(client)
        if correspondentes_df.empty:
            st.warning("Nenhum correspondente cadastrado ainda. Rode o ETL primeiro (etl/etl_reclamacoes.py).")
            return

        correspondente_id_para_nome = {
            linha["id"]: (linha["nome"] or linha["cnpj"]) for _, linha in correspondentes_df.iterrows()
        }

        st.subheader("Visão geral do mês (todos os correspondentes)")
        reclamacoes = buscar_ocorrencias_mes(client, "reclamacoes", list(correspondente_id_para_nome), mes_referencia)
        acoes = buscar_ocorrencias_mes(client, "acoes_judiciais", list(correspondente_id_para_nome), mes_referencia)
        classificacoes = buscar_classificacoes_mes(client, list(correspondente_id_para_nome), mes_referencia)

        visao_geral = montar_visao_geral(correspondente_id_para_nome, reclamacoes, acoes, classificacoes)
        st.dataframe(
            visao_geral[
                [
                    "correspondente",
                    "reclamacoes_total",
                    "reclamacoes_procedentes_corban",
                    "acoes_total",
                    "acoes_procedentes_corban",
                    "tipo_mais_frequente",
                    "indice_formatado",
                    "status_formatado",
                ]
            ].rename(
                columns={
                    "correspondente": "Correspondente",
                    "reclamacoes_total": "Reclamações",
                    "reclamacoes_procedentes_corban": "Reclam. Proc.-Corban",
                    "acoes_total": "Ações Judiciais",
                    "acoes_procedentes_corban": "Ações Proc.-Corban",
                    "tipo_mais_frequente": "Tipo mais frequente",
                    "indice_formatado": "Índice",
                    "status_formatado": "Status",
                }
            ),
            use_container_width=True,
            hide_index=True,
        )

        st.divider()
        st.subheader("Detalhe por correspondente")
        nome_escolhido = st.selectbox("Correspondente", list(correspondente_id_para_nome.values()))
        correspondente_id = next(
            cid for cid, nome in correspondente_id_para_nome.items() if nome == nome_escolhido
        )
        painel_detalhe(client, correspondente_id, nome_escolhido, mes_referencia)

        classificacao_atual = classificacoes[classificacoes["correspondente_id"] == correspondente_id] if not classificacoes.empty else classificacoes
        classificacao_mensal_id = classificacao_atual.iloc[0]["id"] if len(classificacao_atual) else None
        st.divider()
        formulario_medida_aplicada(client, correspondente_id, classificacao_mensal_id, usuario.id)

    else:
        correspondente_id = perfil["correspondente_id"]
        correspondentes_df = listar_correspondentes(client)
        linha_correspondente = correspondentes_df[correspondentes_df["id"] == correspondente_id]
        nome = (
            linha_correspondente.iloc[0]["nome"] or linha_correspondente.iloc[0]["cnpj"]
            if len(linha_correspondente)
            else "meu correspondente"
        )
        painel_detalhe(client, correspondente_id, nome, mes_referencia)


if __name__ == "__main__":
    main()
