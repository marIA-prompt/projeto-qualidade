"""Motor de classificação anual — Quadro 3, art. 5º do Anexo I.

Funções puras. A pontuação geral é a média das componentes disponíveis
(operacional e/ou qualitativa). Sem componente, o status é nao_aplicavel
— nunca se inventa zero.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

STATUS_CONFORME = "conforme"
STATUS_PARCIAL = "parcialmente_conforme"
STATUS_ATENCAO = "em_atencao"
STATUS_NAO_CONFORME = "nao_conforme"
STATUS_NAO_APLICAVEL = "nao_aplicavel"

MEDIDA_1 = ("advertencia", "Advertência")
MEDIDA_2 = ("suspensao_10_dias", "Suspensão de 10 dias úteis")
MEDIDA_3 = ("suspensao_definitiva", "Suspensão definitiva")


@dataclass(frozen=True)
class ResultadoAnual:
    status: str
    aplicavel: bool
    pontuacao: Optional[float]
    motivo: str


def pontuacao_operacional(numerador_corban: int, total_ocorrencias: int) -> Optional[float]:
    if total_ocorrencias <= 0:
        return None
    if numerador_corban < 0:
        raise ValueError("numerador Corban não pode ser negativo")
    return round(100 * (1 - numerador_corban / total_ocorrencias), 2)


def pontuacao_geral(componentes: list[Optional[float]]) -> Optional[float]:
    vals = [c for c in componentes if c is not None]
    if not vals:
        return None
    return round(sum(vals) / len(vals), 2)


def _faixa(pontuacao: float) -> tuple[str, str, str]:
    """Devolve (rótulo, status sem desvio, status com desvio)."""
    if pontuacao >= 90:
        return "≥ 90%", STATUS_CONFORME, STATUS_ATENCAO
    if pontuacao >= 75:
        return "75% a 89%", STATUS_PARCIAL, STATUS_ATENCAO
    if pontuacao >= 45:
        return "45% a 74%", STATUS_ATENCAO, STATUS_ATENCAO
    return "< 45%", STATUS_NAO_CONFORME, STATUS_NAO_CONFORME


def classificar_anual(
    *,
    pontuacao_geral_valor: Optional[float],
    desvio_conduta_grave: bool = False,
) -> ResultadoAnual:
    if pontuacao_geral_valor is None:
        return ResultadoAnual(
            status=STATUS_NAO_APLICAVEL,
            aplicavel=False,
            pontuacao=None,
            motivo="sem pontuação de conformidade no ano — não inventamos zero",
        )
    rotulo, sem, com = _faixa(pontuacao_geral_valor)
    status = com if desvio_conduta_grave else sem
    lado = "com desvio de conduta grave" if desvio_conduta_grave else "sem desvio de conduta grave"
    return ResultadoAnual(
        status=status,
        aplicavel=True,
        pontuacao=pontuacao_geral_valor,
        motivo=f"pontuação {pontuacao_geral_valor:.2f}% na faixa {rotulo} ({lado})",
    )


def exige_medida(status: str) -> bool:
    return status in (STATUS_NAO_CONFORME, STATUS_ATENCAO)


def medida_sugerida_anual(status_atual: str, historico_anterior: list[str]) -> Optional[tuple[int, str, str]]:
    if not exige_medida(status_atual):
        return None
    n = 1
    for s in reversed(historico_anterior):
        if exige_medida(s):
            n += 1
        else:
            break
    if n >= 3:
        codigo, rotulo = MEDIDA_3
    elif n == 2:
        codigo, rotulo = MEDIDA_2
    else:
        codigo, rotulo = MEDIDA_1
    return n, codigo, rotulo
