"""Testes do motor de classificação mensal do agente (Quadro 6, arts. 11–12)."""

import pytest

from motor_agentes.classificacao import LIMITE_INDICE_QUADRO6, classificar_mensal_agente


def test_caso_conforme():
    r = classificar_mensal_agente(
        reclamacoes_procedentes=2,
        acoes_judiciais_procedentes=1,
        total_reclamacoes_mes=5,
        carteira_produzida=1_000,
    )
    assert r.status == "conforme"
    assert r.aplicavel is True
    assert r.numerador == 3
    assert r.indice == pytest.approx(0.003)


def test_caso_nao_conforme():
    r = classificar_mensal_agente(
        reclamacoes_procedentes=7,
        acoes_judiciais_procedentes=3,
        total_reclamacoes_mes=12,
        carteira_produzida=1_000,
    )
    assert r.status == "nao_conforme"
    assert r.indice == pytest.approx(0.01)


def test_limite_exato_075_e_conforme():
    r = classificar_mensal_agente(
        reclamacoes_procedentes=3,
        acoes_judiciais_procedentes=0,
        total_reclamacoes_mes=3,
        carteira_produzida=400,
    )
    assert r.indice == pytest.approx(LIMITE_INDICE_QUADRO6)
    assert r.indice == pytest.approx(0.0075)
    assert r.status == "conforme"
    assert r.aplicavel is True


def test_acima_do_limite_e_nao_conforme():
    r = classificar_mensal_agente(
        reclamacoes_procedentes=4,
        acoes_judiciais_procedentes=0,
        total_reclamacoes_mes=4,
        carteira_produzida=400,
    )
    assert r.indice == pytest.approx(0.01)
    assert r.status == "nao_conforme"


def test_nao_aplicavel_sem_denominador():
    r = classificar_mensal_agente(
        reclamacoes_procedentes=4,
        acoes_judiciais_procedentes=1,
        total_reclamacoes_mes=8,
        carteira_produzida=None,
    )
    assert r.status == "nao_aplicavel"
    assert r.aplicavel is False
    assert r.indice is None
    assert r.denominador is None
    assert "carteira produzida" in r.motivo


def test_nao_aplicavel_denominador_zerado():
    r = classificar_mensal_agente(
        reclamacoes_procedentes=1,
        acoes_judiciais_procedentes=0,
        total_reclamacoes_mes=4,
        carteira_produzida=0,
    )
    assert r.status == "nao_aplicavel"
    assert r.indice is None
    assert "zerada" in r.motivo or "inválido" in r.motivo


def test_corte_and_nao_aplicavel_so_carteira():
    r = classificar_mensal_agente(
        reclamacoes_procedentes=1,
        acoes_judiciais_procedentes=0,
        total_reclamacoes_mes=1,
        carteira_produzida=1_000,
    )
    assert r.status == "nao_aplicavel"
    assert r.aplicavel is False
    assert "corte de aplicabilidade" in r.motivo


def test_corte_and_nao_aplicavel_so_reclamacoes():
    r = classificar_mensal_agente(
        reclamacoes_procedentes=2,
        acoes_judiciais_procedentes=0,
        total_reclamacoes_mes=40,
        carteira_produzida=50,
    )
    assert r.status == "nao_aplicavel"
    assert r.aplicavel is False


def test_corte_and_atingido_51_ops_e_2_rec():
    r = classificar_mensal_agente(
        reclamacoes_procedentes=0,
        acoes_judiciais_procedentes=0,
        total_reclamacoes_mes=2,
        carteira_produzida=51,
    )
    assert r.aplicavel is True
    assert r.status == "conforme"
    assert r.indice == pytest.approx(0.0)


def test_corte_50_ops_ainda_fora_mesmo_com_muitas_rec():
    r = classificar_mensal_agente(
        reclamacoes_procedentes=0,
        acoes_judiciais_procedentes=0,
        total_reclamacoes_mes=9,
        carteira_produzida=50,
    )
    assert r.status == "nao_aplicavel"


def test_indefinidos_nao_entram_no_numerador():
    r = classificar_mensal_agente(
        reclamacoes_procedentes=1,
        acoes_judiciais_procedentes=0,
        total_reclamacoes_mes=15,
        carteira_produzida=1_000,
        pendentes_indefinido=10,
    )
    assert r.numerador == 1
    assert r.pendentes_indefinido == 10
    assert r.status == "conforme"


def test_valores_negativos_rejeitados():
    with pytest.raises(ValueError):
        classificar_mensal_agente(
            reclamacoes_procedentes=-1,
            acoes_judiciais_procedentes=0,
            total_reclamacoes_mes=0,
            carteira_produzida=1_000,
        )
