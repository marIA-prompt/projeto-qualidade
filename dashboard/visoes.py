"""Abas do painel: correspondente, evolução, alertas, relatórios, relacionamento."""

from __future__ import annotations

import pandas as pd
import streamlit as st

from alertas import (
    SEV_ATENCAO,
    SEV_CRITICO,
    SEV_INFO,
    Alerta,
    acao_relacionamento,
)
from pilares import PILARES, SUBCRITERIOS
from relatorios import (
    enviar_relatorio_email,
    montar_relatorio_mensal,
    smtp_configurado,
)

ROTULOS_SEV = {
    SEV_CRITICO: "Crítico",
    SEV_ATENCAO: "Atenção",
    SEV_INFO: "Info",
}


def requisitos_bruna() -> None:
    st.markdown(
        """
        <div class="pq-requisitos">
          <strong>Requisitos Bruna Camargo — cobertos neste painel</strong>
          <ul>
            <li><b>Painel visual por correspondente</b> — aba “Por correspondente”</li>
            <li><b>Alertas automatizados</b> nas métricas (índice, volume, indefinidas, auditoria) — aba “Alertas e relatórios”</li>
            <li><b>Envio de relatórios mensais</b> (download + SMTP da área) — mesma aba</li>
            <li><b>Vertente de relacionamento</b> (conversa e reorientação antes de sanção) — aba “Relacionamento”</li>
          </ul>
        </div>
        """,
        unsafe_allow_html=True,
    )


def serie_mensal(classif_hist: pd.DataFrame) -> pd.DataFrame:
    if classif_hist.empty:
        return classif_hist
    df = classif_hist.copy()
    df["mes"] = pd.to_datetime(df["mes_referencia"]).dt.to_period("M").astype(str)
    return df


def aba_evolucao(classif_hist: pd.DataFrame) -> None:
    st.subheader("Evolução ao longo dos meses")
    st.caption(
        "A série cresce a cada fechamento (ETL). Com um único mês processado "
        "os gráficos mostram o ponto de partida — ago/2026."
    )
    if classif_hist.empty:
        st.info("Nenhum mês processado ainda.")
        return
    hist = serie_mensal(classif_hist)
    consolidado = (
        hist.groupby("mes", as_index=True)
        .agg(
            Reclamacoes=("qtd_reclamacoes", "sum"),
            Acoes_judiciais=("qtd_acoes_judiciais", "sum"),
            Numerador_Quadro5=("numerador", "sum"),
            Nao_conformes=("status", lambda s: int((s == "nao_conforme").sum())),
        )
        .sort_index()
    )
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("**Reclamações, ações e numerador (rede)**")
        st.line_chart(consolidado[["Reclamacoes", "Acoes_judiciais", "Numerador_Quadro5"]])
        st.caption("Com um mês só o gráfico de linha é um ponto; as barras abaixo já mostram a rede.")
    with c2:
        st.markdown("**Correspondentes não conformes por mês**")
        st.bar_chart(consolidado[["Nao_conformes"]])

    st.markdown("**Comparativo entre correspondentes (mês a mês)**")
    nomes = (
        hist.sort_values("qtd_reclamacoes", ascending=False)["correspondente"]
        .dropna()
        .drop_duplicates()
        .tolist()
    )
    padrao = nomes[:5]
    escolhidos = st.multiselect(
        "Correspondentes no gráfico",
        nomes,
        default=padrao,
        max_selections=8,
    )
    if escolhidos:
        rec = (
            hist[hist["correspondente"].isin(escolhidos)]
            .pivot_table(
                index="mes",
                columns="correspondente",
                values="qtd_reclamacoes",
                aggfunc="sum",
            )
            .fillna(0)
            .sort_index()
        )
        st.line_chart(rec)

    st.markdown("**Ocorrências do mês corrente por correspondente**")
    atual = hist.sort_values("mes").groupby("correspondente").tail(1)
    barras = (
        atual.set_index("correspondente")[["qtd_reclamacoes", "qtd_acoes_judiciais"]]
        .rename(columns={
            "qtd_reclamacoes": "Reclamações",
            "qtd_acoes_judiciais": "Ações judiciais",
        })
        .sort_values("Reclamações", ascending=False)
    )
    st.bar_chart(barras)


def aba_por_correspondente(
    df_mes: pd.DataFrame,
    classif_hist: pd.DataFrame,
    resumo: pd.DataFrame,
    alertas: list[Alerta],
    mes: str,
) -> None:
    st.subheader("Painel visual por correspondente")
    st.caption(
        "Visão individual pedida pela área: indicadores, série mensal, "
        "alertas do mês e próximo passo de relacionamento."
    )
    if df_mes.empty:
        st.info("Nenhum correspondente no mês.")
        return
    opcoes = df_mes.sort_values("qtd_reclamacoes", ascending=False).to_dict("records")
    escolhido = st.selectbox(
        "Correspondente",
        opcoes,
        format_func=lambda r: f"{r['correspondente']} ({r['cnpj']})",
    )
    cid = escolhido["correspondente_id"]
    meus = [a for a in alertas if a.correspondente_id == str(cid)]

    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Reclamações", int(escolhido["qtd_reclamacoes"]))
    k2.metric("Ações judiciais", int(escolhido["qtd_acoes_judiciais"]))
    k3.metric(
        "Índice",
        "—" if pd.isna(escolhido.get("indice")) else f"{float(escolhido['indice']) * 100:.4f}%",
    )
    k4.metric("Status", str(escolhido["status"]).replace("_", " ").replace("nao ", "não "))

    c1, c2 = st.columns(2)
    with c1:
        st.markdown("**Indicadores do mês**")
        canal = escolhido.get("canal_mais_frequente")
        carteira = escolhido.get("carteira_denominador")
        st.dataframe(
            pd.DataFrame([
                {"Campo": "Proc.-Corban (reclamações)", "Valor": int(escolhido["qtd_reclamacoes_corban"] or 0)},
                {"Campo": "Proc.-Corban (ações)", "Valor": int(escolhido["qtd_acoes_judiciais_corban"] or 0)},
                {"Campo": "Indefinidas", "Valor": int(escolhido["qtd_indefinidas"] or 0)},
                {"Campo": "Canal mais frequente", "Valor": "—" if pd.isna(canal) or not canal else canal},
                {
                    "Campo": "Carteira produzida",
                    "Valor": "não carregada" if pd.isna(carteira) else int(carteira),
                },
            ]),
            use_container_width=True,
            hide_index=True,
        )
    with c2:
        st.markdown("**Auditorias (indicadores 3 e 4)**")
        if resumo.empty:
            st.caption("Sem registro de auditoria.")
        else:
            bloco = resumo[resumo["correspondente_id"] == cid][
                ["tipo", "data", "pilares", "media"]
            ].rename(columns={
                "tipo": "Tipo", "data": "Data", "pilares": "Pilares", "media": "Média",
            })
            st.dataframe(bloco, use_container_width=True, hide_index=True)

    hist = classif_hist[classif_hist["correspondente_id"] == cid].copy()
    if not hist.empty:
        hist["mes"] = pd.to_datetime(hist["mes_referencia"]).dt.to_period("M").astype(str)
        serie = (
            hist.groupby("mes")[["qtd_reclamacoes", "qtd_acoes_judiciais", "numerador"]]
            .sum()
            .sort_index()
            .rename(columns={
                "qtd_reclamacoes": "Reclamações",
                "qtd_acoes_judiciais": "Ações judiciais",
                "numerador": "Numerador Quadro 5",
            })
        )
        st.markdown("**Série mensal deste correspondente**")
        st.line_chart(serie)

    st.markdown("**Alertas deste correspondente**")
    if not meus:
        st.success("Nenhum alerta automático neste mês.")
    else:
        st.dataframe(_df_alertas(meus), use_container_width=True, hide_index=True)
    st.info(acao_relacionamento(meus))


def aba_alertas_relatorios(
    sb,
    df_mes: pd.DataFrame,
    alertas: list[Alerta],
    mes: str,
    eh_staff: bool,
) -> None:
    st.subheader("Alertas automatizados")
    st.caption(
        "Disparo automático quando o correspondente atinge as métricas: "
        "não conforme (Quadro 5), 80% do teto de 0,03%, ≥ 3 reclamações/mês, "
        "ocorrências indefinidas ou auditoria pendente. Recalculado a cada "
        "abertura do painel — sem ClickUp."
    )
    if not alertas:
        st.success("Nenhum alerta no mês selecionado.")
    else:
        n_c = sum(1 for a in alertas if a.severidade == SEV_CRITICO)
        n_a = sum(1 for a in alertas if a.severidade == SEV_ATENCAO)
        n_i = sum(1 for a in alertas if a.severidade == SEV_INFO)
        m1, m2, m3 = st.columns(3)
        m1.metric("Críticos", n_c)
        m2.metric("Atenção", n_a)
        m3.metric("Informativos", n_i)
        st.dataframe(_df_alertas(alertas), use_container_width=True, hide_index=True)

    st.divider()
    st.subheader("Relatório mensal")
    st.caption(
        "Gera o relatório do mês (rede ou um correspondente) para download "
        "e envio por e-mail à Qualidade. O SMTP é a mesma conta Thunderbird "
        "da área, quando configurada no .env."
    )
    destino_padrao = "maria.morais@senff.com.br"
    nomes = ["Todos"] + sorted(df_mes["correspondente"].unique().tolist()) if not df_mes.empty else ["Todos"]
    alvo = st.selectbox("Escopo do relatório", nomes)
    destinatario = st.text_input("Enviar para", value=destino_padrao)

    recorte = df_mes
    nome_alvo = None
    recorte_alertas = alertas
    if alvo != "Todos" and not df_mes.empty:
        recorte = df_mes[df_mes["correspondente"] == alvo]
        nome_alvo = alvo
        ids = set(recorte["correspondente_id"].astype(str))
        recorte_alertas = [a for a in alertas if a.correspondente_id in ids]

    assunto, corpo = montar_relatorio_mensal(
        mes=mes or "",
        df_mes=recorte,
        alertas=recorte_alertas,
        correspondente=nome_alvo,
    )
    st.download_button(
        "Baixar relatório (.md)",
        data=corpo.encode("utf-8"),
        file_name=f"relatorio_qualidade_{str(mes)[:7]}.md",
        mime="text/markdown",
    )
    with st.expander("Prévia do relatório"):
        st.markdown(corpo)

    if eh_staff and st.button("Enviar relatório por e-mail", type="primary"):
        ok, msg = enviar_relatorio_email(
            destinatario=destinatario, assunto=assunto, corpo=corpo
        )
        _registrar_envio(sb, mes, destinatario, assunto, corpo, ok, msg)
        if ok:
            st.success(msg)
        else:
            st.warning(msg)

    if smtp_configurado():
        st.caption("SMTP configurado — o botão envia de fato.")
    else:
        st.caption(
            "SMTP ainda não está no .env. O relatório já é gerado e baixável; "
            "o envio automático liga quando SMTP_HOST/USUARIO/SENHA forem preenchidos."
        )


def aba_relacionamento(df_mes: pd.DataFrame, alertas: list[Alerta], resumo: pd.DataFrame) -> None:
    st.subheader("Vertente de relacionamento")
    st.caption(
        "Qualidade de Correspondentes não é só índice e sanção. O pilar "
        f"**{PILARES['relacionamento_cliente']}** avalia clareza das informações, "
        "linguagem, qualidade do atendimento, respeito ao consumidor e oferta "
        "responsável. A conversa com o correspondente vem antes da medida punitiva."
    )
    st.markdown("**Subcritérios do pilar Relacionamento com Cliente**")
    for rotulo in SUBCRITERIOS["relacionamento_cliente"].values():
        st.markdown(f"- {rotulo}")

    if df_mes.empty:
        return

    st.markdown("**Onde o relacionamento pede conversa neste mês**")
    rel = [a for a in alertas if a.tipo in ("relacionamento", "volume_reclamacoes", "nao_conforme")]
    if rel:
        st.dataframe(_df_alertas(rel), use_container_width=True, hide_index=True)
    else:
        st.success("Nenhum correspondente com alerta de relacionamento neste mês.")

    ranking = (
        df_mes.sort_values("qtd_reclamacoes", ascending=False)[
            ["correspondente", "cnpj", "qtd_reclamacoes", "canal_mais_frequente", "status"]
        ]
        .head(10)
        .rename(columns={
            "correspondente": "Correspondente",
            "cnpj": "CNPJ",
            "qtd_reclamacoes": "Reclamações",
            "canal_mais_frequente": "Canal (sinal de atendimento)",
            "status": "Status",
        })
    )
    ranking["Próximo passo"] = ranking["Correspondente"].map(
        lambda nome: acao_relacionamento([a for a in alertas if a.correspondente == nome])
    )
    st.markdown("**Fila de acompanhamento (top 10 em reclamações)**")
    st.dataframe(ranking, use_container_width=True, hide_index=True)

    st.info(
        "Medidas discricionárias de relacionamento já cadastradas na escala Senff: "
        "reorientação de conduta e notificação. Suspensão permanece decisão da "
        "Gestora — nunca automática."
    )


def _df_alertas(alertas: list[Alerta]) -> pd.DataFrame:
    return pd.DataFrame([{
        "Severidade": ROTULOS_SEV.get(a.severidade, a.severidade),
        "Correspondente": a.correspondente,
        "Tipo": a.tipo,
        "Mensagem": a.mensagem,
    } for a in alertas])


def _registrar_envio(sb, mes, destinatario, assunto, corpo, ok, msg) -> None:
    try:
        sb.table("relatorios_mensais").insert({
            "mes_referencia": str(mes)[:10] if mes else None,
            "destinatario": destinatario,
            "assunto": assunto,
            "corpo": corpo,
            "status": "enviado" if ok else "falhou",
            "erro": None if ok else msg,
            "enviado_por": st.session_state.get("sessao", {}).get("user_id"),
        }).execute()
    except Exception:
        # Tabela opcional — o envio/download não depende dela.
        pass
