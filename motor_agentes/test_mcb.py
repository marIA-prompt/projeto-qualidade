"""Testes da pontuação MCB do agente (art. 12 §1º–§7º)."""

from datetime import date

from motor_agentes.mcb import (
    LIMIAR_SUSPENSAO,
    PONTOS_NC,
    SUSPENSAO_DEFINITIVA,
    SUSPENSAO_TEMPORARIA,
    adicionar_meses,
    avaliar_mcb,
)


def _nc(*meses: date):
    return [(m, "nao_conforme") for m in meses]


def test_nc_soma_5_pontos():
    r = avaliar_mcb(_nc(date(2026, 1, 1)), na_data=date(2026, 1, 1))
    assert r.pontos_vigentes == PONTOS_NC
    assert r.suspensao is None
    assert len(r.eventos) == 1
    assert r.eventos[0].vigente_ate == date(2027, 1, 1)


def test_conforme_nao_pontua():
    r = avaliar_mcb(
        [(date(2026, 1, 1), "conforme"), (date(2026, 2, 1), "nao_aplicavel")],
        na_data=date(2026, 2, 1),
    )
    assert r.pontos_vigentes == 0
    assert r.suspensao is None
    assert r.eventos == ()


def test_quatro_nc_em_12_meses_suspensao_temporaria():
    hist = _nc(
        date(2026, 1, 1),
        date(2026, 2, 1),
        date(2026, 3, 1),
        date(2026, 4, 1),
    )
    r = avaliar_mcb(hist, na_data=date(2026, 4, 1))
    assert r.pontos_vigentes == LIMIAR_SUSPENSAO
    assert r.suspensao == SUSPENSAO_TEMPORARIA
    assert r.suspensao_inicio == date(2026, 4, 1)
    assert r.suspensao_fim == date(2027, 4, 1)


def test_pontos_expiram_em_12_meses_e_nao_atingem_20():
    hist = _nc(date(2026, 1, 1), date(2026, 2, 1), date(2026, 3, 1))
    em_dez = avaliar_mcb(hist, na_data=date(2026, 12, 1))
    assert em_dez.pontos_vigentes == 15
    assert em_dez.suspensao is None
    em_jan = avaliar_mcb(hist, na_data=date(2027, 1, 1))
    assert em_jan.pontos_vigentes == 10
    em_mar = avaliar_mcb(hist, na_data=date(2027, 3, 1))
    assert em_mar.pontos_vigentes == 0


def test_zera_apos_suspensao_temporaria():
    hist = _nc(
        date(2026, 1, 1),
        date(2026, 2, 1),
        date(2026, 3, 1),
        date(2026, 4, 1),
    )
    durante = avaliar_mcb(hist, na_data=date(2027, 3, 1))
    assert durante.suspensao == SUSPENSAO_TEMPORARIA
    depois = avaliar_mcb(hist, na_data=date(2027, 4, 1))
    assert depois.suspensao is None
    assert depois.pontos_vigentes == 0
    assert depois.zerou_em == date(2027, 4, 1)
    assert depois.eventos == ()


def test_reincidencia_apos_zero_e_suspensao_definitiva():
    primeira = _nc(
        date(2026, 1, 1),
        date(2026, 2, 1),
        date(2026, 3, 1),
        date(2026, 4, 1),
    )
    segunda = _nc(
        date(2027, 5, 1),
        date(2027, 6, 1),
        date(2027, 7, 1),
        date(2027, 8, 1),
    )
    r = avaliar_mcb(primeira + segunda, na_data=date(2027, 8, 1))
    assert r.suspensao == SUSPENSAO_DEFINITIVA
    assert r.suspensao_inicio == date(2027, 8, 1)
    assert r.suspensao_fim is None
    assert r.zerou_em == date(2027, 4, 1)


def test_nc_durante_suspensao_temporaria_nao_entra_na_nova_somatoria():
    hist = _nc(
        date(2026, 1, 1),
        date(2026, 2, 1),
        date(2026, 3, 1),
        date(2026, 4, 1),
        date(2026, 5, 1),
    )
    r = avaliar_mcb(hist, na_data=date(2026, 5, 1))
    assert r.suspensao == SUSPENSAO_TEMPORARIA
    assert r.pontos_vigentes == 20
    assert len(r.eventos) == 4


def test_historico_vazio():
    r = avaliar_mcb([], na_data=date(2026, 8, 1))
    assert r.pontos_vigentes == 0
    assert r.suspensao is None


def test_adicionar_meses():
    assert adicionar_meses(date(2026, 4, 1), 12) == date(2027, 4, 1)
    assert adicionar_meses(date(2025, 12, 1), 1) == date(2026, 1, 1)
