"""Pilares e subcritérios de auditoria — Plano de Qualidade Senff, cap. 5.

A pontuação do pilar é a média simples dos subcritérios avaliados
(ok=100, parcial=50, nao_ok=0). 'nao_avaliado' fica de fora da média.
Isso NÃO é a classificação anual do Quadro 3 (art. 5º) — só consolida o
input manual do FR-3 de forma auditável.
"""

from __future__ import annotations

PILARES: dict[str, str] = {
    "tecnologia_informacao": "Tecnologia da Informação",
    "lgpd": "LGPD",
    "relacionamento_cliente": "Relacionamento com Cliente",
    "governanca": "Políticas de Governança",
    "treinamento": "Treinamento e Aprendizagem",
}

SUBCRITERIOS: dict[str, dict[str, str]] = {
    "tecnologia_informacao": {
        "seguranca_equipamentos": "Segurança dos equipamentos",
        "controle_acesso": "Controle de acesso",
        "armazenamento_documentos": "Armazenamento de documentos",
        "rastreabilidade": "Rastreabilidade",
        "prevencao_fraudes": "Prevenção a fraudes",
    },
    "lgpd": {
        "origem_leads": "Origem dos leads",
        "compartilhamento_dados": "Compartilhamento de dados",
        "tratamento_dados": "Tratamento de dados",
        "consentimento": "Consentimento",
        "armazenamento": "Armazenamento",
    },
    "relacionamento_cliente": {
        "clareza_informacoes": "Clareza das informações",
        "linguagem": "Linguagem utilizada",
        "qualidade_atendimento": "Qualidade do atendimento",
        "respeito_consumidor": "Respeito ao consumidor",
        "oferta_responsavel": "Oferta responsável",
    },
    "governanca": {
        "politicas_internas": "Políticas internas",
        "controles": "Controles",
        "segregacao_funcoes": "Segregação de funções",
        "certificacoes": "Certificações",
        "gestao_documental": "Gestão documental",
    },
    "treinamento": {
        "treinamentos_obrigatorios": "Treinamentos obrigatórios",
        "reciclagens": "Reciclagens",
        "certificacoes": "Certificações",
    },
}

NOTAS = {
    "ok": 100.0,
    "parcial": 50.0,
    "nao_ok": 0.0,
}

ROTULOS_NOTA = {
    "ok": "Ok",
    "parcial": "Parcial",
    "nao_ok": "Não ok",
    "nao_avaliado": "Não avaliado",
}

TIPOS_AUDITORIA = {
    "externa": ("auditorias_externas", "Auditoria externa"),
    "interna": ("auditorias_internas", "Auditoria interna"),
}


def pontuacao_pilar(subcriterios: dict) -> float | None:
    """Média 0–100 dos subcritérios com nota; None se nenhum foi avaliado."""
    notas = [NOTAS[v] for v in subcriterios.values() if v in NOTAS]
    if not notas:
        return None
    return round(sum(notas) / len(notas), 2)
