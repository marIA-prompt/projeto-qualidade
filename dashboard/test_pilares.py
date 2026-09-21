"""Testes da pontuação de pilar (FR-3) — sem I/O."""

from pilares import formatar_pontuacao, parse_pontuacao_manual, pontuacao_pilar


def test_media_simples():
    assert pontuacao_pilar({"a": "ok", "b": "nao_ok"}) == 50.0
    assert pontuacao_pilar({"a": "ok", "b": "ok"}) == 100.0
    assert pontuacao_pilar({"a": "parcial"}) == 50.0


def test_nao_avaliado_fica_de_fora():
    assert pontuacao_pilar({"a": "ok", "b": "nao_avaliado"}) == 100.0


def test_nenhum_avaliado_devolve_none():
    assert pontuacao_pilar({}) is None
    assert pontuacao_pilar({"a": "nao_avaliado"}) is None


def test_percentual_manual_do_relatorio():
    assert parse_pontuacao_manual("92") == 92.0
    assert parse_pontuacao_manual("92%") == 92.0
    assert parse_pontuacao_manual("92,5") == 92.5
    assert parse_pontuacao_manual("") is None
    assert formatar_pontuacao(92) == "92%"
    assert formatar_pontuacao(None) == "—"


def test_percentual_manual_rejeita_fora_da_faixa():
    try:
        parse_pontuacao_manual("101")
        raise AssertionError("esperava erro")
    except ValueError:
        pass
    try:
        parse_pontuacao_manual("abc")
        raise AssertionError("esperava erro")
    except ValueError:
        pass
