"""Pontuação MCB do agente — art. 12 §1º–§7º do Anexo I.

Trilho distinto do correspondente: NÃO usa advertência, suspensão de 10 dias
nem ciclo anual de CNPJ.

Regras literais:
  1. NC no mês base → 5 pontos no MCB para aquele CPF.
  2. Cada pontuação mensal vale 12 meses.
  3. 20 pontos em 12 meses → Participante aplica suspensão temporária ao
     agente vinculado ao correspondente.
  4. Suspensão temporária = 12 meses consecutivos; nesse período os
     Participantes não operam com o agente.
  5. Ao término, pontuação volta a zero.
  6. Reincidência = nova somatória de 20 pontos em 12 meses → suspensão
     definitiva.
  7. O Participante deve disponibilizar o desempenho individual para o
     agente consultar.

Funções puras, sem I/O.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional, Sequence

from motor_agentes.classificacao import STATUS_NAO_CONFORME

PONTOS_NC = 5
JANELA_MESES = 12
LIMIAR_SUSPENSAO = 20
DURACAO_SUSPENSAO_TEMPORARIA_MESES = 12

SUSPENSAO_TEMPORARIA = "temporaria"
SUSPENSAO_DEFINITIVA = "definitiva"


def adicionar_meses(mes: date, meses: int) -> date:
    """Soma meses em data normalizada no dia 1. Não inventa dia civil."""
    base = date(mes.year, mes.month, 1)
    idx = base.year * 12 + (base.month - 1) + meses
    ano, mes_n = divmod(idx, 12)
    return date(ano, mes_n + 1, 1)


def meses_no_intervalo(inicio: date, fim_inclusive: date):
    """Gera o dia 1 de cada mês de inicio até fim, inclusive."""
    atual = date(inicio.year, inicio.month, 1)
    fim = date(fim_inclusive.year, fim_inclusive.month, 1)
    while atual <= fim:
        yield atual
        atual = adicionar_meses(atual, 1)


@dataclass(frozen=True)
class EventoPontuacao:
    mes: date
    pontos: int
    vigente_ate: date  # exclusivo: vale em [mes, vigente_ate)


@dataclass(frozen=True)
class ResultadoMCB:
    pontos_vigentes: int
    eventos: tuple[EventoPontuacao, ...]
    suspensao: Optional[str]  # None | temporaria | definitiva
    suspensao_inicio: Optional[date]
    suspensao_fim: Optional[date]  # exclusivo para temporária; None se definitiva
    zerou_em: Optional[date]
    motivo: str


def _pontos_vigentes_em(
    eventos: Sequence[EventoPontuacao],
    mes: date,
) -> int:
    return sum(e.pontos for e in eventos if e.mes <= mes < e.vigente_ate)


def avaliar_mcb(
    historico: Sequence[tuple[date, str]],
    *,
    na_data: date,
) -> ResultadoMCB:
    """Avalia a pontuação MCB de um CPF até `na_data`."""
    if na_data is None:
        raise ValueError("na_data é obrigatória")

    por_mes: dict[date, str] = {}
    for mes, status in historico:
        chave = date(mes.year, mes.month, 1)
        if chave in por_mes and por_mes[chave] != status:
            raise ValueError(
                f"histórico com dois status para {chave.isoformat()}: "
                f"{por_mes[chave]!r} e {status!r}"
            )
        por_mes[chave] = status

    na = date(na_data.year, na_data.month, 1)
    if not por_mes:
        return ResultadoMCB(
            pontos_vigentes=0,
            eventos=(),
            suspensao=None,
            suspensao_inicio=None,
            suspensao_fim=None,
            zerou_em=None,
            motivo="sem classificação mensal no histórico — nenhuma pontuação MCB",
        )

    inicio = min(por_mes)
    if na < inicio:
        return ResultadoMCB(
            pontos_vigentes=0,
            eventos=(),
            suspensao=None,
            suspensao_inicio=None,
            suspensao_fim=None,
            zerou_em=None,
            motivo="data de avaliação anterior à primeira classificação",
        )

    eventos: list[EventoPontuacao] = []
    suspensao_temp_inicio: Optional[date] = None
    suspensao_temp_fim: Optional[date] = None
    teve_temporaria = False
    definitiva = False
    definitiva_inicio: Optional[date] = None
    zerou_em: Optional[date] = None
    ultimo_zeramento: Optional[date] = None

    for mes in meses_no_intervalo(inicio, na):
        if definitiva:
            break

        if (
            suspensao_temp_fim is not None
            and suspensao_temp_inicio is not None
            and mes >= suspensao_temp_fim
        ):
            eventos = []
            ultimo_zeramento = suspensao_temp_fim
            zerou_em = suspensao_temp_fim
            suspensao_temp_inicio = None
            suspensao_temp_fim = None

        if (
            suspensao_temp_inicio is not None
            and suspensao_temp_fim is not None
            and mes < suspensao_temp_fim
        ):
            continue

        if por_mes.get(mes) == STATUS_NAO_CONFORME:
            eventos.append(
                EventoPontuacao(
                    mes=mes,
                    pontos=PONTOS_NC,
                    vigente_ate=adicionar_meses(mes, JANELA_MESES),
                )
            )

        vigentes = _pontos_vigentes_em(eventos, mes)
        if vigentes >= LIMIAR_SUSPENSAO:
            if teve_temporaria:
                definitiva = True
                definitiva_inicio = mes
            else:
                suspensao_temp_inicio = mes
                suspensao_temp_fim = adicionar_meses(
                    mes, DURACAO_SUSPENSAO_TEMPORARIA_MESES
                )
                teve_temporaria = True

    if definitiva:
        vigentes = _pontos_vigentes_em(eventos, na)
        return ResultadoMCB(
            pontos_vigentes=vigentes,
            eventos=tuple(eventos),
            suspensao=SUSPENSAO_DEFINITIVA,
            suspensao_inicio=definitiva_inicio,
            suspensao_fim=None,
            zerou_em=ultimo_zeramento,
            motivo=(
                f"reincidência: nova somatória de {LIMIAR_SUSPENSAO} pontos "
                f"em {JANELA_MESES} meses após suspensão temporária — "
                "suspensão definitiva"
            ),
        )

    if (
        suspensao_temp_inicio is not None
        and suspensao_temp_fim is not None
        and suspensao_temp_inicio <= na < suspensao_temp_fim
    ):
        vigentes = _pontos_vigentes_em(eventos, na)
        return ResultadoMCB(
            pontos_vigentes=vigentes,
            eventos=tuple(eventos),
            suspensao=SUSPENSAO_TEMPORARIA,
            suspensao_inicio=suspensao_temp_inicio,
            suspensao_fim=suspensao_temp_fim,
            zerou_em=ultimo_zeramento,
            motivo=(
                f"{vigentes} pontos vigentes em {JANELA_MESES} meses "
                f"(limiar {LIMIAR_SUSPENSAO}) — suspensão temporária de "
                f"{DURACAO_SUSPENSAO_TEMPORARIA_MESES} meses consecutivos"
            ),
        )

    vigentes = _pontos_vigentes_em(eventos, na)
    if ultimo_zeramento:
        motivo = (
            f"pontuação zerada em {ultimo_zeramento.isoformat()} ao término "
            f"da suspensão temporária; {vigentes} ponto(s) vigente(s) na "
            f"nova somatória"
        )
    elif vigentes:
        motivo = (
            f"{vigentes} ponto(s) vigente(s) em {JANELA_MESES} meses "
            f"(cada NC = {PONTOS_NC}; limiar de suspensão = {LIMIAR_SUSPENSAO})"
        )
    else:
        motivo = "nenhum NC no período vigente — 0 pontos MCB"

    return ResultadoMCB(
        pontos_vigentes=vigentes,
        eventos=tuple(eventos),
        suspensao=None,
        suspensao_inicio=None,
        suspensao_fim=None,
        zerou_em=ultimo_zeramento,
        motivo=motivo,
    )
