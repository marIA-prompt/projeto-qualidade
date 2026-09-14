"""Testes unitários do motor de classificação mensal (Quadro 5, art. 9º).

Cobre os quatro cenários pedidos na entrega da Fase 1:
    1. caso conforme
    2. caso não conforme
    3. caso não aplicável (sem denominador / carteira produzida)
    4. caso com registros "indefinido" (não devem ser somados ao índice)

Mais casos de borda relevantes para um sistema regulado (corte de
aplicabilidade, denominador zero).
"""

import pytest

from motor_classificacao.classificacao import (
    LIMITE_INDICE,
    LIMITE_OPERACOES,
    LIMITE_RECLAMACOES_MES,
    AgregadoMensalCorrespondente,
    classificar_mensal,
)


def _agregado(**overrides):
    base = dict(
        correspondente_id="corr-1",
        mes_referencia="2026-08",
        qtd_reclamacoes_procedentes_corban=0,
        qtd_acoes_procedentes_corban=0,
        qtd_reclamacoes_mes=0,
        total_operacoes=10_000,
    )
    base.update(overrides)
    return AgregadoMensalCorrespondente(**base)


class TestCasoConforme:
    def test_indice_abaixo_do_limite_e_conforme(self):
        agregado = _agregado(
            qtd_reclamacoes_procedentes_corban=1,
            qtd_acoes_procedentes_corban=0,
            qtd_reclamacoes_mes=5,
            total_operacoes=10_000,
        )
        resultado = classificar_mensal(agregado)

        assert resultado.aplicavel is True
        assert resultado.status == "conforme"
        assert resultado.numerador == 1
        assert resultado.denominador == 10_000
        assert resultado.indice == pytest.approx(1 / 10_000)
        assert resultado.indice < LIMITE_INDICE

    def test_zero_procedentes_e_conforme(self):
        agregado = _agregado(qtd_reclamacoes_mes=4, total_operacoes=5000)
        resultado = classificar_mensal(agregado)

        assert resultado.status == "conforme"
        assert resultado.indice == 0.0


class TestCasoNaoConforme:
    def test_indice_igual_ao_limite_e_nao_conforme(self):
        # índice exatamente 0,03% -> ">= LIMITE_INDICE" deve classificar como não conforme.
        total_operacoes = 10_000
        numerador = round(LIMITE_INDICE * total_operacoes)
        agregado = _agregado(
            qtd_reclamacoes_procedentes_corban=numerador,
            qtd_reclamacoes_mes=numerador,
            total_operacoes=total_operacoes,
        )
        resultado = classificar_mensal(agregado)

        assert resultado.aplicavel is True
        assert resultado.status == "nao_conforme"

    def test_indice_acima_do_limite_e_nao_conforme(self):
        agregado = _agregado(
            qtd_reclamacoes_procedentes_corban=5,
            qtd_acoes_procedentes_corban=3,
            qtd_reclamacoes_mes=5,
            total_operacoes=1_000,
        )
        resultado = classificar_mensal(agregado)

        assert resultado.status == "nao_conforme"
        assert resultado.numerador == 8
        assert resultado.indice == pytest.approx(8 / 1000)


class TestCasoNaoAplicavel:
    def test_sem_carteira_produzida_carregada(self):
        agregado = _agregado(
            qtd_reclamacoes_procedentes_corban=10,
            qtd_reclamacoes_mes=10,
            total_operacoes=None,
        )
        resultado = classificar_mensal(agregado)

        assert resultado.status == "nao_aplicavel"
        assert resultado.aplicavel is False
        assert resultado.indice is None
        assert resultado.denominador is None
        assert "carteira produzida" in resultado.motivo_nao_aplicavel

    def test_corte_de_aplicabilidade_nao_atingido(self):
        agregado = _agregado(
            qtd_reclamacoes_procedentes_corban=1,
            qtd_reclamacoes_mes=1,
            total_operacoes=LIMITE_OPERACOES,  # exatamente no limite: "> 3000" exige estritamente maior
        )
        resultado = classificar_mensal(agregado)

        assert resultado.status == "nao_aplicavel"
        assert resultado.aplicavel is False
        assert resultado.indice is None

    def test_aplicavel_por_volume_de_operacoes_mesmo_com_poucas_reclamacoes(self):
        agregado = _agregado(
            qtd_reclamacoes_procedentes_corban=0,
            qtd_reclamacoes_mes=1,
            total_operacoes=LIMITE_OPERACOES + 1,
        )
        resultado = classificar_mensal(agregado)

        assert resultado.aplicavel is True
        assert resultado.status == "conforme"

    def test_aplicavel_por_quantidade_de_reclamacoes_mesmo_com_poucas_operacoes(self):
        agregado = _agregado(
            qtd_reclamacoes_procedentes_corban=1,
            qtd_reclamacoes_mes=LIMITE_RECLAMACOES_MES,
            total_operacoes=100,
        )
        resultado = classificar_mensal(agregado)

        assert resultado.aplicavel is True

    def test_denominador_zero_nao_quebra_e_e_nao_aplicavel(self):
        agregado = _agregado(
            qtd_reclamacoes_procedentes_corban=1,
            qtd_reclamacoes_mes=LIMITE_RECLAMACOES_MES,
            total_operacoes=0,
        )
        resultado = classificar_mensal(agregado)

        assert resultado.status == "nao_aplicavel"
        assert resultado.indice is None


class TestRegistrosIndefinidos:
    """Registros com `responsavel = 'indefinido'` (sem par na exportação normal
    do mês, ~25% dos casos segundo os dados reais de agosto/2026) não podem
    ser somados ao numerador. Este módulo não sabe o que é "indefinido" — a
    responsabilidade de excluir esses registros é da etapa de agregação
    (etl/transform.py). Este teste prova que, se a agregação for feita
    corretamente (excluindo indefinidos), o resultado muda em relação a uma
    agregação (incorreta) que os incluísse.
    """

    def test_excluir_indefinidos_do_numerador_muda_a_classificacao(self):
        total_operacoes = 10_000

        # 2 reclamações confirmadas Corban + 5 "indefinidas" que NÃO deveriam contar.
        procedentes_corban_confirmadas = 2
        indefinidas_erroneamente_somadas = 5

        agregado_correto = _agregado(
            qtd_reclamacoes_procedentes_corban=procedentes_corban_confirmadas,
            qtd_reclamacoes_mes=7,
            total_operacoes=total_operacoes,
        )
        agregado_incorreto_incluindo_indefinidos = _agregado(
            qtd_reclamacoes_procedentes_corban=procedentes_corban_confirmadas + indefinidas_erroneamente_somadas,
            qtd_reclamacoes_mes=7,
            total_operacoes=total_operacoes,
        )

        resultado_correto = classificar_mensal(agregado_correto)
        resultado_incorreto = classificar_mensal(agregado_incorreto_incluindo_indefinidos)

        assert resultado_correto.numerador == 2
        assert resultado_correto.status == "conforme"

        # Se indefinidos fossem somados por engano, o índice subiria e viraria não conforme —
        # exatamente o erro que o briefing de negócio pede para evitar.
        assert resultado_incorreto.numerador == 7
        assert resultado_incorreto.status == "nao_conforme"
        assert resultado_correto.indice < resultado_incorreto.indice


class TestValidacaoDeEntrada:
    def test_quantidade_negativa_levanta_erro(self):
        with pytest.raises(ValueError):
            _agregado(qtd_reclamacoes_procedentes_corban=-1)

    def test_total_operacoes_negativo_levanta_erro(self):
        with pytest.raises(ValueError):
            _agregado(total_operacoes=-1)
