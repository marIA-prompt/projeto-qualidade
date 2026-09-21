"""Testes de normalização e máscara de CPF."""

from motor_agentes.cpf import cpf_para_log, mascarar_cpf, normalizar_cpf


def test_normaliza_11_digitos():
    assert normalizar_cpf("12345678901") == "12345678901"


def test_normaliza_com_mascara_e_zero_a_esquerda():
    assert normalizar_cpf("123.456.789-01") == "12345678901"
    assert normalizar_cpf("18777040") == "00018777040"


def test_vazio_e_lixo_viram_none():
    assert normalizar_cpf(None) is None
    assert normalizar_cpf("") is None
    assert normalizar_cpf("null") is None
    assert normalizar_cpf("-") is None
    assert normalizar_cpf("abc") is None


def test_mais_de_11_digitos_nao_inventa():
    assert normalizar_cpf("123456789012") is None


def test_mascara_parcial():
    assert mascarar_cpf("00018777040") == "***.***.***-40"
    assert mascarar_cpf(None) == "***.***.***-**"


def test_log_nunca_expoe_cpf_completo():
    bruto = "44406071873"
    log = cpf_para_log(bruto)
    assert bruto not in log
    assert log.endswith("-73")
