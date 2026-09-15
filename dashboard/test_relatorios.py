import pandas as pd

from alertas import avaliar_correspondente
from relatorios import montar_relatorio_mensal, smtp_configurado


def test_relatorio_contem_indicadores_e_escopo():
    df = pd.DataFrame([{
        "correspondente_id": "c1",
        "correspondente": "CONECT",
        "cnpj": "123",
        "qtd_reclamacoes": 41,
        "qtd_reclamacoes_corban": 1,
        "qtd_acoes_judiciais": 20,
        "qtd_acoes_judiciais_corban": 6,
        "qtd_indefinidas": 16,
        "indice": None,
        "status": "nao_aplicavel",
    }])
    alertas = avaliar_correspondente(
        correspondente_id="c1",
        correspondente="CONECT",
        mes_referencia="2026-08-01",
        status="nao_aplicavel",
        indice=None,
        qtd_reclamacoes=41,
        qtd_indefinidas=16,
        canal_mais_frequente="Procon",
        tem_auditoria_externa=False,
        tem_auditoria_interna=False,
    )
    assunto, corpo = montar_relatorio_mensal(
        mes="2026-08-01", df_mes=df, alertas=alertas
    )
    assert "2026-08" in assunto
    assert "CONECT" in corpo
    assert "Reclamações" in corpo
    assert "Relacionamento" in corpo
    assert "Alertas" not in corpo
    assert "automatizado" not in corpo.lower()


def test_smtp_ausente_nao_quebra():
    assert smtp_configurado() in (True, False)
