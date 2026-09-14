"""Motor de classificação mensal — Quadro 5, art. 9º do Anexo I.

Módulo de funções puras, sem I/O e sem dependência de banco ou dashboard.
Recebe os agregados já limpos pelo ETL e devolve o status regulatório.

Regra (art. 9º):

    índice = (reclamações procedentes-Corban + ações judiciais
              procedentes-Corban no mês) / carteira produzida desde jan/2023

    - Aplicável apenas a correspondentes com > 3.000 operações acumuladas
      OU >= 3 reclamações no mês.
    - índice <  0,03%  -> 'conforme'
    - índice >= 0,03%  -> 'nao_conforme'
    - Corte não atingido ou denominador ausente -> 'nao_aplicavel'
      (nunca inventar valor nem assumir zero).

Registros com responsavel = 'indefinido' (sem atribuição Corban/Senff)
NUNCA entram no numerador; são reportados em `pendentes_indefinido` para
confirmação manual.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

# Limiar regulatório do Quadro 5: 0,03% = 0.0003 (fração).
LIMITE_INDICE_QUADRO5 = 0.0003

# Corte de aplicabilidade (art. 9º).
CORTE_OPERACOES = 3000        # aplicável se operações acumuladas > 3.000
CORTE_RECLAMACOES_MES = 3     # OU se reclamações no mês >= 3

STATUS_CONFORME = "conforme"
STATUS_NAO_CONFORME = "nao_conforme"
STATUS_NAO_APLICAVEL = "nao_aplicavel"


@dataclass(frozen=True)
class ResultadoMensal:
    """Resultado da classificação mensal de um correspondente."""

    status: str                    # conforme | nao_conforme | nao_aplicavel
    aplicavel: bool
    numerador: int                 # procedentes-Corban (reclamações + ações)
    denominador: Optional[int]     # carteira produzida; None = não carregada
    indice: Optional[float]        # numerador/denominador; None se não aplicável
    motivo: str                    # justificativa auditável do status
    pendentes_indefinido: int      # registros sem atribuição Corban/Senff


def classificar_mensal(
    *,
    reclamacoes_procedentes_corban: int,
    acoes_judiciais_procedentes_corban: int,
    total_reclamacoes_mes: int,
    carteira_produzida: Optional[int],
    pendentes_indefinido: int = 0,
    limite_indice: float = LIMITE_INDICE_QUADRO5,
    corte_operacoes: int = CORTE_OPERACOES,
    corte_reclamacoes_mes: int = CORTE_RECLAMACOES_MES,
) -> ResultadoMensal:
    """Classifica um correspondente no mês segundo o Quadro 5 (art. 9º).

    Args:
        reclamacoes_procedentes_corban: reclamações do mês com parecer
            "Procedente - Corban" (já deduplicadas por unitariedade).
        acoes_judiciais_procedentes_corban: idem para ações judiciais.
        total_reclamacoes_mes: total de reclamações do mês (independente de
            parecer), usado no corte de aplicabilidade ">= 3 reclamações/mês".
        carteira_produzida: operações acumuladas desde jan/2023 (denominador).
            None quando ainda não carregada para o correspondente/mês.
        pendentes_indefinido: registros sem atribuição Corban/Senff — apenas
            reportados, nunca somados ao numerador.
    """
    for nome, valor in (
        ("reclamacoes_procedentes_corban", reclamacoes_procedentes_corban),
        ("acoes_judiciais_procedentes_corban", acoes_judiciais_procedentes_corban),
        ("total_reclamacoes_mes", total_reclamacoes_mes),
        ("pendentes_indefinido", pendentes_indefinido),
    ):
        if valor < 0:
            raise ValueError(f"{nome} não pode ser negativo (recebido: {valor})")

    numerador = reclamacoes_procedentes_corban + acoes_judiciais_procedentes_corban

    # Sem denominador não há índice: nunca assumir zero nem quebrar.
    if carteira_produzida is None:
        return ResultadoMensal(
            status=STATUS_NAO_APLICAVEL,
            aplicavel=False,
            numerador=numerador,
            denominador=None,
            indice=None,
            motivo="carteira produzida não carregada para o correspondente/mês",
            pendentes_indefinido=pendentes_indefinido,
        )
    if carteira_produzida <= 0:
        return ResultadoMensal(
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
        or total_reclamacoes_mes >= corte_reclamacoes_mes
    )
    if not atingiu_corte:
        return ResultadoMensal(
            status=STATUS_NAO_APLICAVEL,
            aplicavel=False,
            numerador=numerador,
            denominador=carteira_produzida,
            indice=None,
            motivo=(
                f"corte de aplicabilidade não atingido "
                f"({carteira_produzida} operações <= {corte_operacoes} e "
                f"{total_reclamacoes_mes} reclamações/mês < {corte_reclamacoes_mes})"
            ),
            pendentes_indefinido=pendentes_indefinido,
        )

    indice = numerador / carteira_produzida
    if indice < limite_indice:
        status, motivo = STATUS_CONFORME, (
            f"índice {indice:.6f} abaixo do limite regulatório {limite_indice:.6f}"
        )
    else:
        status, motivo = STATUS_NAO_CONFORME, (
            f"índice {indice:.6f} igual ou acima do limite regulatório {limite_indice:.6f}"
        )

    return ResultadoMensal(
        status=status,
        aplicavel=True,
        numerador=numerador,
        denominador=carteira_produzida,
        indice=indice,
        motivo=motivo,
        pendentes_indefinido=pendentes_indefinido,
    )
