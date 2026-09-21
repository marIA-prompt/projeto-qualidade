"""Motor de classificação mensal do agente — Quadro 6, arts. 11 e 12 do Anexo I.

Módulo de funções puras, sem I/O e sem dependência de banco ou dashboard.
Recebe os agregados já limpos pelo ETL e devolve o status regulatório.

Regra (arts. 11 e 12):

    índice = (reclamações procedentes do mês + ações judiciais procedentes
              do mês) / carteira produzida pelo agente desde janeiro de 2023

    - Aplicável apenas se o agente tiver MAIS DE 50 operações de crédito
      E MAIS DE 1 reclamação no mês (art. 12, III — é E, não OU).
    - índice <= 0,75%  -> 'conforme'     (igual a 0,75% é conforme)
    - índice >  0,75%  -> 'nao_conforme'
    - Corte não atingido ou denominador ausente -> 'nao_aplicavel'
      (nunca inventar valor nem assumir zero).

NÃO copiar a inclusividade do Quadro 5 (≥ 0,03% já é NC no correspondente).

Registros com responsavel = 'indefinido' (sem par na normal / sem atribuição)
NUNCA entram no numerador; são reportados em `pendentes_indefinido`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

# Limiar regulatório do Quadro 6: 0,75% = 0.0075 (fração).
LIMITE_INDICE_QUADRO6 = 0.0075

# Corte de aplicabilidade (art. 12, III) — os dois, conjuntamente.
CORTE_OPERACOES = 50  # aplicável se operações acumuladas > 50
CORTE_RECLAMACOES_MES = 1  # E se reclamações no mês > 1

STATUS_CONFORME = "conforme"
STATUS_NAO_CONFORME = "nao_conforme"
STATUS_NAO_APLICAVEL = "nao_aplicavel"

STATUS_VALIDOS = (STATUS_CONFORME, STATUS_NAO_CONFORME, STATUS_NAO_APLICAVEL)


@dataclass(frozen=True)
class ResultadoMensalAgente:
    """Resultado da classificação mensal de um agente de crédito (CPF)."""

    status: str  # conforme | nao_conforme | nao_aplicavel
    aplicavel: bool
    numerador: int  # procedentes (reclamações + ações) — indefinido fora
    denominador: Optional[int]  # carteira do agente; None = não carregada
    indice: Optional[float]  # numerador/denominador; None se não aplicável
    motivo: str  # justificativa auditável do status
    pendentes_indefinido: int  # registros sem atribuição — nunca no numerador


def classificar_mensal_agente(
    *,
    reclamacoes_procedentes: int,
    acoes_judiciais_procedentes: int,
    total_reclamacoes_mes: int,
    carteira_produzida: Optional[int],
    pendentes_indefinido: int = 0,
    limite_indice: float = LIMITE_INDICE_QUADRO6,
    corte_operacoes: int = CORTE_OPERACOES,
    corte_reclamacoes_mes: int = CORTE_RECLAMACOES_MES,
) -> ResultadoMensalAgente:
    """Classifica um agente (CPF) no mês segundo o Quadro 6 (arts. 11 e 12)."""
    for nome, valor in (
        ("reclamacoes_procedentes", reclamacoes_procedentes),
        ("acoes_judiciais_procedentes", acoes_judiciais_procedentes),
        ("total_reclamacoes_mes", total_reclamacoes_mes),
        ("pendentes_indefinido", pendentes_indefinido),
    ):
        if valor < 0:
            raise ValueError(f"{nome} não pode ser negativo (recebido: {valor})")

    numerador = reclamacoes_procedentes + acoes_judiciais_procedentes

    if carteira_produzida is None:
        return ResultadoMensalAgente(
            status=STATUS_NAO_APLICAVEL,
            aplicavel=False,
            numerador=numerador,
            denominador=None,
            indice=None,
            motivo="carteira produzida do agente não carregada para o CPF/mês",
            pendentes_indefinido=pendentes_indefinido,
        )
    if carteira_produzida <= 0:
        return ResultadoMensalAgente(
            status=STATUS_NAO_APLICAVEL,
            aplicavel=False,
            numerador=numerador,
            denominador=carteira_produzida,
            indice=None,
            motivo="carteira produzida zerada — denominador inválido para o índice",
            pendentes_indefinido=pendentes_indefinido,
        )

    atingiu_corte = (
        carteira_produzida > corte_operacoes
        and total_reclamacoes_mes > corte_reclamacoes_mes
    )
    if not atingiu_corte:
        return ResultadoMensalAgente(
            status=STATUS_NAO_APLICAVEL,
            aplicavel=False,
            numerador=numerador,
            denominador=carteira_produzida,
            indice=None,
            motivo=(
                f"corte de aplicabilidade não atingido "
                f"(precisa operações > {corte_operacoes} E reclamações/mês "
                f"> {corte_reclamacoes_mes}; recebido {carteira_produzida} "
                f"operações e {total_reclamacoes_mes} reclamações/mês)"
            ),
            pendentes_indefinido=pendentes_indefinido,
        )

    indice = numerador / carteira_produzida
    if indice <= limite_indice:
        status, motivo = STATUS_CONFORME, (
            f"índice {indice:.6f} menor ou igual ao limite regulatório "
            f"{limite_indice:.6f} (0,75%)"
        )
    else:
        status, motivo = STATUS_NAO_CONFORME, (
            f"índice {indice:.6f} acima do limite regulatório "
            f"{limite_indice:.6f} (0,75%)"
        )

    return ResultadoMensalAgente(
        status=status,
        aplicavel=True,
        numerador=numerador,
        denominador=carteira_produzida,
        indice=indice,
        motivo=motivo,
        pendentes_indefinido=pendentes_indefinido,
    )
