"""Testes da ingestão de carteira produzida (planilha manual)."""

import pytest

from etl_carteira import carregar_planilha
from etl_reclamacoes import e_procedente_corban


def test_carrega_planilha_ponto_e_virgula(tmp_path):
    f = tmp_path / "carteira.csv"
    f.write_text(
        "cnpj;nome;operacoes_mes;operacoes_acumuladas_desde_2023;fonte\n"
        "12.345.678/0001-99;CORBAN A;10;4000;manual\n",
        encoding="utf-8",
    )
    df = carregar_planilha(str(f))
    assert df.iloc[0]["cnpj"] == "12345678000199"
    assert int(df.iloc[0]["operacoes_acumuladas_desde_2023"]) == 4000
    assert int(df.iloc[0]["operacoes_mes"]) == 10


def test_rejeita_sem_denominador(tmp_path):
    f = tmp_path / "carteira.csv"
    f.write_text("cnpj;nome\n111;A\n", encoding="utf-8")
    with pytest.raises(ValueError, match="obrigatórias"):
        carregar_planilha(str(f))


def test_rejeita_cnpj_duplicado(tmp_path):
    f = tmp_path / "carteira.csv"
    f.write_text(
        "cnpj;operacoes_acumuladas_desde_2023\n111;10\n111;20\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="duplicado"):
        carregar_planilha(str(f))


def test_e_procedente_corban():
    assert e_procedente_corban("corban", "Procedente - Corban") is True
    assert e_procedente_corban("corban", "Procedente") is True
    assert e_procedente_corban("senff", "Procedente - Senff") is False
    assert e_procedente_corban("indefinido", "Procedente") is False
    assert e_procedente_corban("corban", "Improcedente - Corban") is False
    assert e_procedente_corban("corban", None) is False
