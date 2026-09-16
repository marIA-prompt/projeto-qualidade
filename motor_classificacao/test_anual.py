"""Testes do Quadro 3 (classificação anual)."""

from motor_classificacao.anual import (
    classificar_anual,
    medida_sugerida_anual,
    pontuacao_geral,
    pontuacao_operacional,
)


def test_sem_ocorrencia_nao_inventa_zero():
    assert pontuacao_operacional(0, 0) is None


def test_operacional_90_por_cento():
    assert pontuacao_operacional(1, 10) == 90


def test_media_ignora_ausente():
    assert pontuacao_geral([90, None]) == 90
    assert pontuacao_geral([None, None]) is None


def test_faixas_sem_desvio():
    assert classificar_anual(pontuacao_geral_valor=90).status == "conforme"
    assert classificar_anual(pontuacao_geral_valor=75).status == "parcialmente_conforme"
    assert classificar_anual(pontuacao_geral_valor=45).status == "em_atencao"
    assert classificar_anual(pontuacao_geral_valor=44.9).status == "nao_conforme"


def test_desvio_grave_impede_conforme():
    assert classificar_anual(pontuacao_geral_valor=95, desvio_conduta_grave=True).status == "em_atencao"
    assert classificar_anual(pontuacao_geral_valor=80, desvio_conduta_grave=True).status == "em_atencao"
    assert classificar_anual(pontuacao_geral_valor=10, desvio_conduta_grave=True).status == "nao_conforme"


def test_ciclo_medidas():
    assert medida_sugerida_anual("conforme", []) is None
    assert medida_sugerida_anual("nao_conforme", [])[1] == "advertencia"
    assert medida_sugerida_anual("em_atencao", ["nao_conforme"])[1] == "suspensao_10_dias"
    assert medida_sugerida_anual("nao_conforme", ["em_atencao", "nao_conforme"])[1] == "suspensao_definitiva"
