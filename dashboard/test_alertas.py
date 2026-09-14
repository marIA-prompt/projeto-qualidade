from alertas import (
    SEV_ATENCAO,
    SEV_CRITICO,
    TIPO_NAO_CONFORME,
    TIPO_RELACIONAMENTO,
    TIPO_VOLUME_RECLAMACOES,
    acao_relacionamento,
    avaliar_correspondente,
)
from motor_classificacao.classificacao import LIMITE_INDICE_QUADRO5


def _base(**kwargs):
    dados = dict(
        correspondente_id="c1",
        correspondente="CONECT",
        mes_referencia="2026-08-01",
        status="nao_aplicavel",
        indice=None,
        qtd_reclamacoes=1,
        qtd_indefinidas=0,
        canal_mais_frequente=None,
        tem_auditoria_externa=True,
        tem_auditoria_interna=True,
    )
    dados.update(kwargs)
    return avaliar_correspondente(**dados)


def test_nao_conforme_e_critico():
    alertas = _base(status="nao_conforme", indice=LIMITE_INDICE_QUADRO5)
    tipos = {a.tipo for a in alertas}
    assert TIPO_NAO_CONFORME in tipos
    assert any(a.severidade == SEV_CRITICO for a in alertas)


def test_volume_e_relacionamento():
    alertas = _base(
        qtd_reclamacoes=8,
        canal_mais_frequente="Procon",
        tem_auditoria_externa=False,
        tem_auditoria_interna=False,
    )
    tipos = {a.tipo for a in alertas}
    assert TIPO_VOLUME_RECLAMACOES in tipos
    assert TIPO_RELACIONAMENTO in tipos
    assert any(a.severidade == SEV_ATENCAO for a in alertas)


def test_indice_abaixo_do_limiar_interno_nao_alerta():
    alertas = _base(status="conforme", indice=LIMITE_INDICE_QUADRO5 * 0.5)
    assert all(a.tipo != "indice_atencao" for a in alertas)


def test_acao_relacionamento_prioriza_conversa():
    alertas = _base(qtd_reclamacoes=5, canal_mais_frequente="SAC")
    texto = acao_relacionamento(alertas)
    assert "conversa" in texto.lower()
