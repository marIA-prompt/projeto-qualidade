"""Funções puras de apresentação/agregação usadas pelo dashboard.

Mantidas fora de `app.py` e sem nenhuma chamada de rede para poderem ser
testadas com `pytest` sem precisar de um Supabase real, e para reforçar a
regra do projeto: **o dashboard não decide classificação regulatória** — ele
só formata e resume o que o ETL e o `motor_classificacao` já calcularam.
"""

from __future__ import annotations

from collections import Counter
from typing import Optional

import pandas as pd

RESPONSAVEL_CORBAN = "corban"
RESPONSAVEL_SENFF = "senff"
RESPONSAVEL_INDEFINIDO = "indefinido"

_ROTULOS_STATUS = {
    "conforme": "✅ Conforme",
    "nao_conforme": "🔴 Não conforme",
    "nao_aplicavel": "⚪ Não aplicável",
    "sem_classificacao": "— Sem classificação calculada",
}


def contar_por_atribuicao(registros: list[dict]) -> dict:
    """Recebe as linhas cruas de `reclamacoes`/`acoes_judiciais` (já filtradas
    por correspondente/mês) e devolve a contagem por atribuição, no mesmo
    critério do motor de classificação: só "procedente" + "corban" conta para
    o índice."""
    total = len(registros)
    procedentes_corban = sum(
        1 for r in registros if r.get("responsavel") == RESPONSAVEL_CORBAN and r.get("parecer_detalhado") == "procedente"
    )
    procedentes_senff = sum(
        1 for r in registros if r.get("responsavel") == RESPONSAVEL_SENFF and r.get("parecer_detalhado") == "procedente"
    )
    indefinidos = sum(1 for r in registros if r.get("responsavel") == RESPONSAVEL_INDEFINIDO)
    return {
        "total": total,
        "procedentes_corban": procedentes_corban,
        "procedentes_senff": procedentes_senff,
        "indefinidos": indefinidos,
    }


def tipo_mais_frequente(registros: list[dict], campo: str = "tipo_reclamacao") -> Optional[str]:
    valores = [r[campo] for r in registros if r.get(campo)]
    if not valores:
        return None
    return Counter(valores).most_common(1)[0][0]


def formatar_indice_percentual(indice: Optional[float]) -> str:
    if indice is None:
        return "—"
    return f"{indice * 100:.4f}%"


def rotulo_status(status: Optional[str]) -> str:
    if status is None:
        status = "sem_classificacao"
    return _ROTULOS_STATUS.get(status, status)


def montar_visao_geral(
    correspondente_id_para_nome: dict[str, str],
    reclamacoes: pd.DataFrame,
    acoes_judiciais: pd.DataFrame,
    classificacoes: pd.DataFrame,
) -> pd.DataFrame:
    """Monta uma linha por correspondente com os indicadores de Reclamações e
    Ações Judiciais + status da classificação mensal (FR-5).
    """
    linhas = []
    for correspondente_id, nome in correspondente_id_para_nome.items():
        rec = (
            reclamacoes[reclamacoes["correspondente_id"] == correspondente_id]
            if not reclamacoes.empty
            else reclamacoes
        )
        acoes = (
            acoes_judiciais[acoes_judiciais["correspondente_id"] == correspondente_id]
            if not acoes_judiciais.empty
            else acoes_judiciais
        )
        classificacao = (
            classificacoes[classificacoes["correspondente_id"] == correspondente_id]
            if not classificacoes.empty
            else classificacoes
        )

        resumo_reclamacoes = contar_por_atribuicao(rec.to_dict("records"))
        resumo_acoes = contar_por_atribuicao(acoes.to_dict("records"))

        status = classificacao.iloc[0]["status"] if len(classificacao) else None
        indice = classificacao.iloc[0]["indice"] if len(classificacao) else None
        classificacao_mensal_id = classificacao.iloc[0]["id"] if len(classificacao) else None

        linhas.append(
            {
                "correspondente_id": correspondente_id,
                "correspondente": nome,
                "reclamacoes_total": resumo_reclamacoes["total"],
                "reclamacoes_procedentes_corban": resumo_reclamacoes["procedentes_corban"],
                "reclamacoes_procedentes_senff": resumo_reclamacoes["procedentes_senff"],
                "reclamacoes_indefinidas": resumo_reclamacoes["indefinidos"],
                "acoes_total": resumo_acoes["total"],
                "acoes_procedentes_corban": resumo_acoes["procedentes_corban"],
                "acoes_procedentes_senff": resumo_acoes["procedentes_senff"],
                "acoes_indefinidas": resumo_acoes["indefinidos"],
                "tipo_mais_frequente": tipo_mais_frequente(rec.to_dict("records")),
                "indice": indice,
                "indice_formatado": formatar_indice_percentual(indice),
                "status": status,
                "status_formatado": rotulo_status(status),
                "classificacao_mensal_id": classificacao_mensal_id,
            }
        )

    colunas = [
        "correspondente_id",
        "correspondente",
        "reclamacoes_total",
        "reclamacoes_procedentes_corban",
        "reclamacoes_procedentes_senff",
        "reclamacoes_indefinidas",
        "acoes_total",
        "acoes_procedentes_corban",
        "acoes_procedentes_senff",
        "acoes_indefinidas",
        "tipo_mais_frequente",
        "indice",
        "indice_formatado",
        "status",
        "status_formatado",
        "classificacao_mensal_id",
    ]
    return pd.DataFrame(linhas, columns=colunas)
