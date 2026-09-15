"""Relatório mensal (texto) e envio por SMTP.

O envio usa a conta SMTP da área (mesma do Thunderbird). Sem SMTP
configurado o relatório é gerado e fica pronto para download/envio.
"""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from datetime import date

import pandas as pd

from alertas import Alerta


def _fmt_indice(v) -> str:
    if v is None or (isinstance(v, float) and v != v):
        return "—"
    try:
        if pd.isna(v):
            return "—"
    except Exception:
        pass
    return f"{float(v) * 100:.4f}%"


def _fmt_mes(mes: str) -> str:
    texto = str(mes)[:10]
    if len(texto) >= 7:
        return texto[:7]
    return texto


def montar_relatorio_mensal(
    *,
    mes: str,
    df_mes: pd.DataFrame,
    alertas: list[Alerta],
    correspondente: str | None = None,
) -> tuple[str, str]:
    """Devolve (assunto, corpo em Markdown)."""
    mes_rotulo = _fmt_mes(mes)
    escopo = correspondente or "todos os correspondentes"
    assunto = f"[Senff] Relatório mensal de qualidade — {mes_rotulo} — {escopo}"

    linhas = [
        f"# Relatório mensal de qualidade de correspondentes",
        f"",
        f"**Banco Senff** · Plano de Qualidade · mês {mes_rotulo}",
        f"**Escopo:** {escopo}",
        f"**Gerado em:** {date.today().isoformat()}",
        f"",
        f"## Resumo",
    ]
    if df_mes is None or df_mes.empty:
        linhas.append("Nenhum correspondente classificado neste mês.")
        return assunto, "\n".join(linhas)

    linhas.extend([
        f"- Correspondentes: **{len(df_mes)}**",
        f"- Não conformes: **{int((df_mes['status'] == 'nao_conforme').sum())}**",
        f"- Não aplicáveis (sem carteira/corte): **{int((df_mes['status'] == 'nao_aplicavel').sum())}**",
        f"- Reclamações: **{int(df_mes['qtd_reclamacoes'].sum())}** "
        f"({int(df_mes['qtd_reclamacoes_corban'].fillna(0).sum())} procedente Corban)",
        f"- Ações judiciais: **{int(df_mes['qtd_acoes_judiciais'].sum())}** "
        f"({int(df_mes['qtd_acoes_judiciais_corban'].fillna(0).sum())} procedente Corban)",
        f"- Em andamento (fora do índice): **{int(df_mes['qtd_indefinidas'].sum())}**",
        f"",
        f"## Por correspondente",
        f"",
        f"| Correspondente | CNPJ | Reclamações | Ações | Índice | Status |",
        f"|---|---|---:|---:|---|---|",
    ])
    for _, r in df_mes.sort_values("correspondente").iterrows():
        linhas.append(
            f"| {r['correspondente']} | {r['cnpj']} | "
            f"{int(r['qtd_reclamacoes'])} | {int(r['qtd_acoes_judiciais'])} | "
            f"{_fmt_indice(r.get('indice'))} | {r['status']} |"
        )

    linhas.extend([
        "",
        "## Relacionamento",
        "",
        "A vertente de relacionamento vem antes da sanção: conversa de "
        "acompanhamento, reorientação de conduta e notificação. Medidas de "
        "suspensão são ato da Gestora de Qualidade — o sistema nunca aplica "
        "sanção sozinho.",
        "",
        "— Qualidade e Compliance · Banco Senff",
    ])
    return assunto, "\n".join(linhas)


def smtp_configurado() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USUARIO"))


def enviar_relatorio_email(
    *,
    destinatario: str,
    assunto: str,
    corpo: str,
) -> tuple[bool, str]:
    """Envia o relatório. Sem SMTP, devolve falha explicada (o painel ainda gera o arquivo)."""
    if not destinatario or "@" not in destinatario:
        return False, "Destinatário inválido."
    if not smtp_configurado():
        return False, (
            "SMTP ainda não configurado no .env (SMTP_HOST / SMTP_USUARIO / "
            "SMTP_SENHA). O relatório foi gerado para download; o envio "
            "automático fica ativo quando a conta Thunderbird da área for ligada."
        )

    host = os.environ["SMTP_HOST"]
    porta = int(os.environ.get("SMTP_PORT") or 587)
    usuario = os.environ["SMTP_USUARIO"]
    senha = os.environ.get("SMTP_SENHA") or ""
    remetente = os.environ.get("SMTP_REMETENTE") or usuario

    msg = EmailMessage()
    msg["Subject"] = assunto
    msg["From"] = remetente
    msg["To"] = destinatario
    msg.set_content(corpo)

    try:
        with smtplib.SMTP(host, porta, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(usuario, senha)
            smtp.send_message(msg)
    except Exception as exc:
        return False, f"Falha SMTP: {exc}"
    return True, f"Enviado para {destinatario}."
