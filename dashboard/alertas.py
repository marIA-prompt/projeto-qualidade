"""Alertas automatizados a partir das métricas do Quadro 5.

Avaliação determinística (sem IA): o painel recalcula a cada carga.
A decisão de medida administrativa continua humana (FR-11).
"""

from __future__ import annotations

from dataclasses import dataclass

from motor_classificacao.classificacao import (
    CORTE_RECLAMACOES_MES,
    LIMITE_INDICE_QUADRO5,
)

# Limiar interno de atenção: 80% do limite regulatório (0,03%).
LIMIAR_ALERTA_INTERNO = LIMITE_INDICE_QUADRO5 * 0.8

SEV_CRITICO = "critico"
SEV_ATENCAO = "atencao"
SEV_INFO = "info"

TIPO_NAO_CONFORME = "nao_conforme"
TIPO_INDICE_ATENCAO = "indice_atencao"
TIPO_VOLUME_RECLAMACOES = "volume_reclamacoes"
TIPO_INDEFINIDAS = "indefinidas"
TIPO_AUDITORIA_PENDENTE = "auditoria_pendente"
TIPO_RELACIONAMENTO = "relacionamento"


@dataclass(frozen=True)
class Alerta:
    correspondente_id: str
    correspondente: str
    mes_referencia: str
    tipo: str
    severidade: str
    mensagem: str


def avaliar_correspondente(
    *,
    correspondente_id: str,
    correspondente: str,
    mes_referencia: str,
    status: str,
    indice: float | None,
    qtd_reclamacoes: int,
    qtd_indefinidas: int,
    canal_mais_frequente: str | None,
    tem_auditoria_externa: bool,
    tem_auditoria_interna: bool,
    limiar_interno: float = LIMIAR_ALERTA_INTERNO,
    corte_reclamacoes: int = CORTE_RECLAMACOES_MES,
) -> list[Alerta]:
    """Gera a lista de alertas de um correspondente no mês."""
    alertas: list[Alerta] = []
    base = dict(
        correspondente_id=correspondente_id,
        correspondente=correspondente,
        mes_referencia=mes_referencia,
    )

    if status == "nao_conforme":
        alertas.append(Alerta(
            **base,
            tipo=TIPO_NAO_CONFORME,
            severidade=SEV_CRITICO,
            mensagem=(
                f"{correspondente} ficou não conforme no Quadro 5 "
                f"(índice ≥ {LIMITE_INDICE_QUADRO5 * 100:.2f}%)."
            ),
        ))
    elif indice is not None and indice >= limiar_interno:
        pct = indice * 100
        alertas.append(Alerta(
            **base,
            tipo=TIPO_INDICE_ATENCAO,
            severidade=SEV_ATENCAO,
            mensagem=(
                f"{correspondente} atingiu {pct:.4f}% do índice "
                f"(limiar interno de {limiar_interno * 100:.4f}%, "
                f"80% do teto regulatório)."
            ),
        ))

    if qtd_reclamacoes >= corte_reclamacoes:
        alertas.append(Alerta(
            **base,
            tipo=TIPO_VOLUME_RECLAMACOES,
            severidade=SEV_ATENCAO,
            mensagem=(
                f"{correspondente} teve {qtd_reclamacoes} reclamações no mês "
                f"(corte de aplicabilidade ≥ {corte_reclamacoes})."
            ),
        ))

    if qtd_indefinidas > 0:
        alertas.append(Alerta(
            **base,
            tipo=TIPO_INDEFINIDAS,
            severidade=SEV_INFO,
            mensagem=(
                f"{correspondente} tem {qtd_indefinidas} ocorrência(s) sem "
                f"atribuição Corban/Senff — não entram no índice até confirmação."
            ),
        ))

    if not tem_auditoria_externa or not tem_auditoria_interna:
        faltando = []
        if not tem_auditoria_externa:
            faltando.append("externa")
        if not tem_auditoria_interna:
            faltando.append("interna")
        alertas.append(Alerta(
            **base,
            tipo=TIPO_AUDITORIA_PENDENTE,
            severidade=SEV_INFO,
            mensagem=(
                f"{correspondente} sem auditoria {' e '.join(faltando)} "
                f"registrada — indicadores 3 e 4 do art. 51."
            ),
        ))

    if qtd_reclamacoes >= corte_reclamacoes and canal_mais_frequente:
        alertas.append(Alerta(
            **base,
            tipo=TIPO_RELACIONAMENTO,
            severidade=SEV_ATENCAO,
            mensagem=(
                f"{correspondente}: volume de reclamações concentrado no canal "
                f"'{canal_mais_frequente}'. Priorizar conversa de relacionamento "
                f"(clareza, atendimento, oferta responsável) antes de medida punitiva."
            ),
        ))

    return alertas


def avaliar_painel(df_mes, resumo, mes: str) -> list[Alerta]:
    """Avalia todos os correspondentes do mês (DataFrames do dashboard)."""
    if df_mes is None or df_mes.empty:
        return []

    ext_ok: set[str] = set()
    int_ok: set[str] = set()
    if resumo is not None and not resumo.empty:
        ext = resumo[(resumo["tipo"] == "Auditoria externa") & resumo["data"].notna()]
        inte = resumo[(resumo["tipo"] == "Auditoria interna") & resumo["data"].notna()]
        ext_ok = set(ext["correspondente_id"].astype(str))
        int_ok = set(inte["correspondente_id"].astype(str))

    saida: list[Alerta] = []
    for _, row in df_mes.iterrows():
        cid = str(row["correspondente_id"])
        indice = row["indice"] if "indice" in row else None
        if indice is not None and (indice != indice):  # NaN
            indice = None
        elif indice is not None:
            indice = float(indice)
        canal = row.get("canal_mais_frequente")
        if canal is not None and (canal != canal or canal == ""):
            canal = None
        saida.extend(avaliar_correspondente(
            correspondente_id=cid,
            correspondente=str(row.get("correspondente") or "—"),
            mes_referencia=mes,
            status=str(row.get("status") or "nao_aplicavel"),
            indice=indice,
            qtd_reclamacoes=int(row.get("qtd_reclamacoes") or 0),
            qtd_indefinidas=int(row.get("qtd_indefinidas") or 0),
            canal_mais_frequente=None if canal is None else str(canal),
            tem_auditoria_externa=cid in ext_ok,
            tem_auditoria_interna=cid in int_ok,
        ))
    ordem = {SEV_CRITICO: 0, SEV_ATENCAO: 1, SEV_INFO: 2}
    return sorted(saida, key=lambda a: (ordem.get(a.severidade, 9), a.correspondente))


def acao_relacionamento(alertas: list[Alerta]) -> str:
    """Próximo passo de relacionamento (conversa > punição)."""
    tipos = {a.tipo for a in alertas}
    if TIPO_NAO_CONFORME in tipos:
        return (
            "Agendar reunião de acompanhamento com o correspondente. "
            "A Gestora de Qualidade decide se cabe medida; o sistema não aplica "
            "sanção automática. Preferir reorientação de conduta / notificação "
            "antes de suspensão."
        )
    if TIPO_RELACIONAMENTO in tipos or TIPO_VOLUME_RECLAMACOES in tipos:
        return (
            "Abrir conversa de relacionamento focada no canal com mais reclamações: "
            "clareza das informações, qualidade do atendimento e oferta responsável."
        )
    if TIPO_INDEFINIDAS in tipos:
        return (
            "Pedir ao correspondente a atribuição Corban/Senff das ocorrências "
            "indefinidas — sem isso o índice fica incompleto."
        )
    if TIPO_AUDITORIA_PENDENTE in tipos:
        return (
            "Combinar janela de auditoria interna/externa, começando pelo pilar "
            "Relacionamento com Cliente."
        )
    return "Manter rotina de relacionamento: feedback do mês e alinhamento de qualidade."
