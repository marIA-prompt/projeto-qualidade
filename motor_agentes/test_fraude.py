"""Testes do trilho golpe/fraude/falsidade — arts. 13 e 14 (arquivo 104)."""

import pytest

from motor_agentes.fraude import (
    ACAO_MONITORAMENTO_1,
    ACAO_MONITORAMENTO_2,
    ACAO_SUSPENSAO_DEFINITIVA,
    RISCO_ALTO,
    RISCO_BAIXO,
    RISCO_MODERADO,
    classificar_fraude_104,
)


def test_sem_registro():
    r = classificar_fraude_104(0)
    assert r.risco is None
    assert r.acao is None
    assert r.participantes_distintos == 0
    assert "arquivo 104" in r.motivo


def test_um_participante_monitoramento_1():
    r = classificar_fraude_104(1)
    assert r.risco == RISCO_BAIXO
    assert r.acao == ACAO_MONITORAMENTO_1


def test_dois_participantes_monitoramento_2():
    r = classificar_fraude_104(2)
    assert r.risco == RISCO_MODERADO
    assert r.acao == ACAO_MONITORAMENTO_2


def test_tres_ou_mais_suspensao_definitiva():
    r3 = classificar_fraude_104(3)
    assert r3.risco == RISCO_ALTO
    assert r3.acao == ACAO_SUSPENSAO_DEFINITIVA
    r5 = classificar_fraude_104(5)
    assert r5.risco == RISCO_ALTO
    assert r5.acao == ACAO_SUSPENSAO_DEFINITIVA
    assert r5.participantes_distintos == 5


def test_negativo_rejeitado():
    with pytest.raises(ValueError):
        classificar_fraude_104(-1)
