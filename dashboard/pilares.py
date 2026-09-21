"""Pilares de auditoria — alinhados ao relatório EY/FEBRABAN.

A pontuação gravada é a do relatório oficial (percentual 0–100 digitado).
Não se calcula média de subcritérios: o radar da EY traz nota 1–4 por pilar
e uma pontuação final única (ex.: 92% Em Conformidade).
"""

from __future__ import annotations

PILARES: dict[str, str] = {
    "lgpd": "Adequação à LGPD",
    "treinamento": "Aprendizado e Conhecimento",
    "governanca": "Políticas de Governança",
    "relacionamento_cliente": "Relacionamento com Cliente",
    "tecnologia_informacao": "Tecnologia da Informação",
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
    """Média 0–100 dos subcritérios com nota; None se nenhum foi avaliado.

    Mantida para registros antigos. O formulário atual grava percentual
    digitado via parse_pontuacao_manual.
    """
    notas = [NOTAS[v] for v in subcriterios.values() if v in NOTAS]
    if not notas:
        return None
    return round(sum(notas) / len(notas), 2)


def parse_pontuacao_manual(bruto) -> float | None:
    """Percentual do relatório oficial (0–100). Vazio = None. Não calcula média."""
    raw = str(bruto or "").strip().replace("%", "").replace(",", ".")
    if not raw:
        return None
    try:
        n = float(raw)
    except ValueError as exc:
        raise ValueError("Informe a pontuação da auditoria (0 a 100).") from exc
    if n < 0 or n > 100:
        raise ValueError("A pontuação da auditoria deve estar entre 0 e 100.")
    return round(n, 2)


def formatar_pontuacao(valor) -> str:
    if valor is None or valor == "":
        return "—"
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return "—"
    texto = str(int(n)) if n == int(n) else str(n)
    return f"{texto}%"
