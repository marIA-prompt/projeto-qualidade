"""Trilho de golpe / fraude / falsidade ideológica — arts. 13 e 14 do Anexo I.

Separado do índice do Quadro 6. Informar via arquivo específico 104.
Só práticas COMPROVADAS que deram causa a reclamações ou ações judiciais
procedentes de golpe, fraude ou falsidade ideológica.

Por CPF, conforme quantidade de Participantes distintos com registro:

    1 Participante  → risco baixo     → Monitoramento 1
    2 Participantes → risco moderado  → Monitoramento 2
    3 ou mais       → risco alto      → suspensão definitiva

Funções puras, sem I/O. O motor não decide se a prática é comprovada —
recebe a contagem de Participantes distintos já filtrada pelo arquivo 104.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

RISCO_BAIXO = "baixo"
RISCO_MODERADO = "moderado"
RISCO_ALTO = "alto"

ACAO_MONITORAMENTO_1 = "monitoramento_1"
ACAO_MONITORAMENTO_2 = "monitoramento_2"
ACAO_SUSPENSAO_DEFINITIVA = "suspensao_definitiva"


@dataclass(frozen=True)
class ResultadoFraude:
    participantes_distintos: int
    risco: Optional[str]  # None se sem registro
    acao: Optional[str]
    motivo: str


def classificar_fraude_104(participantes_distintos: int) -> ResultadoFraude:
    """Classifica o trilho 104 de um CPF pela quantidade de Participantes."""
    if participantes_distintos < 0:
        raise ValueError(
            f"participantes_distintos não pode ser negativo "
            f"(recebido: {participantes_distintos})"
        )
    if participantes_distintos == 0:
        return ResultadoFraude(
            participantes_distintos=0,
            risco=None,
            acao=None,
            motivo="sem registro comprovado no arquivo 104",
        )
    if participantes_distintos == 1:
        return ResultadoFraude(
            participantes_distintos=1,
            risco=RISCO_BAIXO,
            acao=ACAO_MONITORAMENTO_1,
            motivo=(
                "1 Participante distinto com registro comprovado — "
                "Monitoramento 1 (monitorar operações segundo políticas internas)"
            ),
        )
    if participantes_distintos == 2:
        return ResultadoFraude(
            participantes_distintos=2,
            risco=RISCO_MODERADO,
            acao=ACAO_MONITORAMENTO_2,
            motivo=(
                "2 Participantes distintos com registro comprovado — "
                "Monitoramento 2 (monitorar + ações complementares)"
            ),
        )
    return ResultadoFraude(
        participantes_distintos=participantes_distintos,
        risco=RISCO_ALTO,
        acao=ACAO_SUSPENSAO_DEFINITIVA,
        motivo=(
            f"{participantes_distintos} Participantes distintos com registro "
            "comprovado — risco alto, suspensão definitiva"
        ),
    )
