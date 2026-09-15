import pandas as pd

from fechamento import csv_fechamento, e_procedente_senff, montar_export_fechamento


def test_export_usa_contagens_das_ocorrencias():
    df = pd.DataFrame([{
        "correspondente_id": "c1",
        "correspondente": "CONECT",
        "cnpj": "111",
        "mes_referencia": "2026-08-01",
        "qtd_reclamacoes": 2,
        "qtd_reclamacoes_corban": 1,
        "qtd_acoes_judiciais": 1,
        "qtd_acoes_judiciais_corban": 0,
        "qtd_indefinidas": 1,
        "canal_mais_frequente": "Procon",
        "numerador": 1,
        "carteira_denominador": None,
        "indice": None,
        "status": "nao_aplicavel",
    }])
    rec = [
        {"correspondente_id": "c1", "responsavel": "corban", "parecer": "Procedente - Corban"},
        {"correspondente_id": "c1", "responsavel": "indefinido", "parecer": "Procedente"},
    ]
    aj = [
        {"correspondente_id": "c1", "responsavel": "senff", "parecer": "Procedente - Senff"},
    ]
    out = montar_export_fechamento(df, rec, aj)
    assert len(out) == 1
    row = out.iloc[0]
    assert row["qtd_reclamacoes_total"] == 2
    assert row["qtd_reclamacoes_procedentes_corban"] == 1
    assert row["qtd_reclamacoes_procedentes_senff"] == 0
    assert row["qtd_reclamacoes_indefinidas"] == 1
    assert row["qtd_acoes_judiciais_procedentes_senff"] == 1
    assert "fraudes" not in out.columns
    csv = csv_fechamento(out).decode("utf-8-sig")
    assert "CONECT" in csv
    assert "nao_aplicavel" in csv


def test_procedente_senff_nao_conta_corban():
    assert e_procedente_senff("senff", "Procedente - Senff")
    assert not e_procedente_senff("corban", "Procedente - Corban")
    assert not e_procedente_senff("senff", "Improcedente - Senff")
