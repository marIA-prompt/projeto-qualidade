"""Testes do motor de classificação mensal (Quadro 5, art. 9º do Anexo I).

Rodar a partir da raiz do repositório:  pytest motor_classificacao/
"""

import pytest

from classificacao import (
    LIMITE_INDICE_QUADRO5,
    classificar_mensal,
)


def test_caso_conforme():
    # 2 procedentes-Corban sobre 10.000 operações = 0,02% < 0,03%
    r = classificar_mensal(
        reclamacoes_procedentes_corban=1,
        acoes_judiciais_procedentes_corban=1,
        total_reclamacoes_mes=5,
        carteira_produzida=10_000,
    )
    assert r.status == "conforme"
    assert r.aplicavel is True
    assert r.numerador == 2
    assert r.indice == pytest.approx(0.0002)


def test_caso_nao_conforme():
    # 7 procedentes-Corban sobre 10.000 operações = 0,07% >= 0,03%
    r = classificar_mensal(
        reclamacoes_procedentes_corban=5,
        acoes_judiciais_procedentes_corban=2,
        total_reclamacoes_mes=12,
        carteira_produzida=10_000,
    )
    assert r.status == "nao_conforme"
    assert r.indice == pytest.approx(0.0007)


def test_limite_exato_e_nao_conforme():
    # Regra: índice >= 0,03% já é não conforme (limite inclusivo).
    r = classificar_mensal(
        reclamacoes_procedentes_corban=3,
        acoes_judiciais_procedentes_corban=0,
        total_reclamacoes_mes=3,
        carteira_produzida=10_000,
    )
    assert r.indice == pytest.approx(LIMITE_INDICE_QUADRO5)
    assert r.status == "nao_conforme"


def test_nao_aplicavel_sem_denominador():
    # Carteira produzida ainda não carregada: nunca assumir zero nem quebrar.
    r = classificar_mensal(
        reclamacoes_procedentes_corban=4,
        acoes_judiciais_procedentes_corban=1,
        total_reclamacoes_mes=8,
        carteira_produzida=None,
    )
    assert r.status == "nao_aplicavel"
    assert r.aplicavel is False
    assert r.indice is None
    assert r.denominador is None
    assert "carteira produzida" in r.motivo


def test_nao_aplicavel_denominador_zerado():
    r = classificar_mensal(
        reclamacoes_procedentes_corban=1,
        acoes_judiciais_procedentes_corban=0,
        total_reclamacoes_mes=4,
        carteira_produzida=0,
    )
    assert r.status == "nao_aplicavel"
    assert r.indice is None


def test_nao_aplicavel_corte_nao_atingido():
    # 2.000 operações (<= 3.000) e 2 reclamações no mês (< 3): fora do corte.
    r = classificar_mensal(
        reclamacoes_procedentes_corban=1,
        acoes_judiciais_procedentes_corban=0,
        total_reclamacoes_mes=2,
        carteira_produzida=2_000,
    )
    assert r.status == "nao_aplicavel"
    assert r.aplicavel is False
    assert "corte de aplicabilidade" in r.motivo


def test_corte_atingido_por_reclamacoes_mesmo_com_carteira_pequena():
    # Carteira pequena (<= 3.000), mas >= 3 reclamações no mês: aplicável.
    r = classificar_mensal(
        reclamacoes_procedentes_corban=0,
        acoes_judiciais_procedentes_corban=0,
        total_reclamacoes_mes=3,
        carteira_produzida=1_000,
    )
    assert r.aplicavel is True
    assert r.status == "conforme"


def test_indefinidos_nao_entram_no_numerador():
    # 10 registros indefinidos não podem virar numerador: só os Corban contam.
    r = classificar_mensal(
        reclamacoes_procedentes_corban=1,
        acoes_judiciais_procedentes_corban=0,
        total_reclamacoes_mes=15,
        carteira_produzida=100_000,
        pendentes_indefinido=10,
    )
    assert r.numerador == 1
    assert r.pendentes_indefinido == 10
    assert r.status == "conforme"


def test_valores_negativos_rejeitados():
    with pytest.raises(ValueError):
        classificar_mensal(
            reclamacoes_procedentes_corban=-1,
            acoes_judiciais_procedentes_corban=0,
            total_reclamacoes_mes=0,
            carteira_produzida=10_000,
        )
