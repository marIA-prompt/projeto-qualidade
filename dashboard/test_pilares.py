"""Testes da pontuação de pilar (FR-3) — sem I/O."""

from pilares import pontuacao_pilar


def test_media_simples():
    assert pontuacao_pilar({"a": "ok", "b": "nao_ok"}) == 50.0
    assert pontuacao_pilar({"a": "ok", "b": "ok"}) == 100.0
    assert pontuacao_pilar({"a": "parcial"}) == 50.0


def test_nao_avaliado_fica_de_fora():
    assert pontuacao_pilar({"a": "ok", "b": "nao_avaliado"}) == 100.0


def test_nenhum_avaliado_devolve_none():
    assert pontuacao_pilar({}) is None
    assert pontuacao_pilar({"a": "nao_avaliado"}) is None
