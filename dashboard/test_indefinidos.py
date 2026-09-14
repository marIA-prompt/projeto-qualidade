from datetime import date

from etl.etl_reclamacoes import e_procedente_corban
from indefinidos import log_confirmacao, payload_confirmacao, sufixo_confirmacao


def test_sufixo_nao_duplica():
    hoje = date(2026, 9, 14)
    uma = sufixo_confirmacao("Improcedente", "corban", hoje)
    duas = sufixo_confirmacao(uma, "corban", hoje)
    assert uma == duas
    assert uma.endswith("[V1: confirmado corban em 2026-09-14]")


def test_payload_nao_inventa_procedente():
    p = payload_confirmacao("Improcedente — cliente sem razão", "corban", date(2026, 9, 14))
    assert p["responsavel"] == "corban"
    assert p["parecer"].startswith("Improcedente")
    assert not e_procedente_corban(p["responsavel"], p["parecer"])


def test_procedente_original_entra_no_indice_depois_de_confirmar_corban():
    p = payload_confirmacao("Procedente", "corban", date(2026, 9, 14))
    assert e_procedente_corban(p["responsavel"], p["parecer"])


def test_log_usa_schema_v1_jsonb():
    log = log_confirmacao(
        "reclamacoes",
        "abc",
        "senff",
        "user-1",
        "texto",
        "texto [V1: confirmado senff em 2026-09-14]",
    )
    assert log["tabela_afetada"] == "reclamacoes"
    assert log["operacao"] == "update"
    assert log["dados_antigos"]["responsavel"] == "indefinido"
    assert log["dados_novos"]["responsavel"] == "senff"
    assert "parecer" in log["dados_novos"]
