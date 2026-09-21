"""Gera dados/preview/snapshot.json a partir do motor determinístico.

Não lê CSV do Navigate (PII). O recorte segue a estrutura do ETL do irmão
(agregado por CPF, sem CPF de cliente). Carteira ausente → nao_aplicavel.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from motor_agentes.classificacao import classificar_mensal_agente
from motor_agentes.cpf import mascarar_cpf
from motor_agentes.fraude import classificar_fraude_104
from motor_agentes.mcb import avaliar_mcb

ROOT = Path(__file__).resolve().parents[1]
SAIDA = ROOT / "dados" / "preview" / "snapshot.json"

AGENTES = [
    {
        "cpf": "11144477735",
        "nome": "Digitador Alfa",
        "corban": "Loja Norte",
        "cnpj": "11222333000181",
        "carteira": None,
        "meses": {
            "2026-06": {"rec": 4, "rec_corban": 0, "aj": 2, "aj_corban": 0, "indef": 1},
            "2026-07": {"rec": 3, "rec_corban": 0, "aj": 5, "aj_corban": 0, "indef": 0},
            "2026-08": {"rec": 5, "rec_corban": 0, "aj": 11, "aj_corban": 0, "indef": 2},
        },
        "canais": ["Procon", "BACEN"],
        "fraude": 0,
    },
    {
        "cpf": "22233344405",
        "nome": "Digitador Beta",
        "corban": "Loja Sul",
        "cnpj": "44555666000172",
        "carteira": 1000,
        "meses": {
            "2026-06": {"rec": 3, "rec_corban": 1, "aj": 1, "aj_corban": 0, "indef": 0},
            "2026-07": {"rec": 4, "rec_corban": 2, "aj": 1, "aj_corban": 1, "indef": 0},
            "2026-08": {"rec": 5, "rec_corban": 2, "aj": 1, "aj_corban": 1, "indef": 0},
        },
        "canais": ["Procon"],
        "fraude": 0,
    },
    {
        "cpf": "33322211196",
        "nome": "Digitador Gama",
        "corban": "Loja Norte",
        "cnpj": "11222333000181",
        "carteira": 400,
        "meses": {
            "2026-06": {"rec": 2, "rec_corban": 1, "aj": 0, "aj_corban": 0, "indef": 0},
            "2026-07": {"rec": 3, "rec_corban": 3, "aj": 0, "aj_corban": 0, "indef": 0},
            "2026-08": {"rec": 4, "rec_corban": 4, "aj": 0, "aj_corban": 0, "indef": 0},
        },
        "canais": ["Ouvidoria"],
        "fraude": 1,
    },
    {
        "cpf": "44455566607",
        "nome": "Digitador Delta",
        "corban": "Loja Leste",
        "cnpj": "77888999000163",
        "carteira": 50,
        "meses": {
            "2026-06": {"rec": 8, "rec_corban": 1, "aj": 0, "aj_corban": 0, "indef": 0},
            "2026-07": {"rec": 9, "rec_corban": 2, "aj": 1, "aj_corban": 0, "indef": 0},
            "2026-08": {"rec": 9, "rec_corban": 2, "aj": 1, "aj_corban": 0, "indef": 0},
        },
        "canais": ["Procon", "Reclame Aqui"],
        "fraude": 0,
    },
    {
        "cpf": "55566677718",
        "nome": "Digitador Epsilon",
        "corban": "Loja Sul",
        "cnpj": "44555666000172",
        "carteira": 1000,
        "meses": {
            "2026-06": {"rec": 1, "rec_corban": 1, "aj": 0, "aj_corban": 0, "indef": 0},
            "2026-07": {"rec": 1, "rec_corban": 0, "aj": 0, "aj_corban": 0, "indef": 0},
            "2026-08": {"rec": 1, "rec_corban": 0, "aj": 0, "aj_corban": 0, "indef": 0},
        },
        "canais": ["Procon"],
        "fraude": 0,
    },
    {
        "cpf": "66677788829",
        "nome": "Digitador Zeta",
        "corban": "Loja Oeste",
        "cnpj": "99000111000154",
        "carteira": 400,
        "meses": {
            "2026-06": {"rec": 3, "rec_corban": 3, "aj": 0, "aj_corban": 0, "indef": 0},
            "2026-07": {"rec": 3, "rec_corban": 3, "aj": 0, "aj_corban": 0, "indef": 0},
            "2026-08": {"rec": 3, "rec_corban": 3, "aj": 0, "aj_corban": 0, "indef": 0},
        },
        "canais": ["BACEN"],
        "fraude": 2,
    },
]


def _classificacao(agente: dict, mes: str, vol: dict) -> dict:
    r = classificar_mensal_agente(
        reclamacoes_procedentes=vol["rec_corban"],
        acoes_judiciais_procedentes=vol["aj_corban"],
        total_reclamacoes_mes=vol["rec"],
        carteira_produzida=agente["carteira"],
        pendentes_indefinido=vol["indef"],
    )
    return {
        "mes_referencia": mes,
        "cpf_agente": agente["cpf"],
        "cpf_agente_mascarado": mascarar_cpf(agente["cpf"]),
        "nome_agente": agente["nome"],
        "cnpj_correspondente": agente["cnpj"],
        "cnpjs_vinculo": agente["cnpj"],
        "nome_correspondente": agente["corban"],
        "qtd_reclamacoes_total": vol["rec"],
        "qtd_reclamacoes_procedentes_corban": vol["rec_corban"],
        "qtd_reclamacoes_procedentes_senff": 0,
        "qtd_reclamacoes_indefinidas": vol["indef"] if vol["rec"] else 0,
        "qtd_acoes_judiciais_total": vol["aj"],
        "qtd_acoes_judiciais_procedentes_corban": vol["aj_corban"],
        "qtd_acoes_judiciais_procedentes_senff": 0,
        "qtd_acoes_judiciais_indefinidas": 0,
        "qtd_encaminhadas_fraudes": 0,
        "tipo_ocorrencia_mais_frequente": agente["canais"][0] if agente["canais"] else "",
        "numerador_indice_quadro6": r.numerador,
        "carteira_denominador": r.denominador,
        "indice": r.indice,
        "aplicavel": r.aplicavel,
        "status": r.status,
        "motivo": r.motivo,
        "numerador": r.numerador,
    }


def _ocorrencias(agente: dict, mes: str, vol: dict) -> list[dict]:
    linhas = []
    n = 0
    for i in range(vol["rec"]):
        n += 1
        canal = agente["canais"][i % len(agente["canais"])]
        procedente = i < vol["rec_corban"]
        linhas.append(
            {
                "id": f"{agente['cpf']}-{mes}-r{n}",
                "tipo_ocorrencia": "4",
                "cnpj_correspondente": agente["cnpj"],
                "nome_correspondente": agente["corban"],
                "nome_agente": agente["nome"],
                "cpf_agente": agente["cpf"],
                "cpf_agente_mascarado": mascarar_cpf(agente["cpf"]),
                "canal_origem": canal,
                "tipo_reclamacao": None,
                "parecer": "Procedente - Corban" if procedente else "Em andamento",
                "parecer_detalhado": "Procedente - Corban" if procedente else None,
                "numero_contrato": f"2026{mes[5:7]}{n:04d}",
                "encaminhou_fraudes": False,
                "data_ocorrencia": f"{mes}-05",
                "data_encerramento": f"{mes}-20",
                "procedente": procedente,
                "responsavel": "corban" if procedente else "indefinido",
                "mes_referencia": f"{mes}-01",
                "duplicada_unitariedade": False,
                "excecao_cpf": False,
                "sem_cpf_agente": False,
            }
        )
    for i in range(vol["aj"]):
        n += 1
        procedente = i < vol["aj_corban"]
        linhas.append(
            {
                "id": f"{agente['cpf']}-{mes}-a{n}",
                "tipo_ocorrencia": "1",
                "cnpj_correspondente": agente["cnpj"],
                "nome_correspondente": agente["corban"],
                "nome_agente": agente["nome"],
                "cpf_agente": agente["cpf"],
                "cpf_agente_mascarado": mascarar_cpf(agente["cpf"]),
                "canal_origem": "Ação judicial",
                "tipo_reclamacao": None,
                "parecer": "Procedente - Corban" if procedente else "Em andamento",
                "parecer_detalhado": "Procedente - Corban" if procedente else None,
                "numero_contrato": f"2026{mes[5:7]}{n:04d}",
                "encaminhou_fraudes": False,
                "data_ocorrencia": f"{mes}-08",
                "data_encerramento": f"{mes}-22",
                "procedente": procedente,
                "responsavel": "corban" if procedente else "indefinido",
                "mes_referencia": f"{mes}-01",
                "duplicada_unitariedade": False,
                "excecao_cpf": False,
                "sem_cpf_agente": False,
            }
        )
    return linhas


def main() -> None:
    classificacoes = []
    ocorrencias = []
    for agente in AGENTES:
        for mes, vol in agente["meses"].items():
            classificacoes.append(_classificacao(agente, mes, vol))
            ocorrencias.extend(_ocorrencias(agente, mes, vol))

    pontuacoes = []
    for agente in AGENTES:
        hist = [
            (date.fromisoformat(c["mes_referencia"] + "-01"), c["status"])
            for c in classificacoes
            if c["cpf_agente"] == agente["cpf"]
        ]
        r = avaliar_mcb(hist, na_data=date(2026, 8, 1))
        pontuacoes.append(
            {
                "cpf_agente": agente["cpf"],
                "cpf_agente_mascarado": mascarar_cpf(agente["cpf"]),
                "nome_agente": agente["nome"],
                "pontos_vigentes": r.pontos_vigentes,
                "suspensao": r.suspensao,
                "suspensao_inicio": r.suspensao_inicio.isoformat() if r.suspensao_inicio else None,
                "suspensao_fim": r.suspensao_fim.isoformat() if r.suspensao_fim else None,
                "zerou_em": r.zerou_em.isoformat() if r.zerou_em else None,
                "motivo": r.motivo,
                "eventos": [
                    {
                        "mes": e.mes.isoformat()[:7],
                        "pontos": e.pontos,
                        "vigente_ate": e.vigente_ate.isoformat()[:7],
                    }
                    for e in r.eventos
                ],
            }
        )

    fraude = []
    for agente in AGENTES:
        if not agente["fraude"]:
            continue
        f = classificar_fraude_104(agente["fraude"])
        fraude.append(
            {
                "cpf_agente": agente["cpf"],
                "cpf_agente_mascarado": mascarar_cpf(agente["cpf"]),
                "participantes_distintos": f.participantes_distintos,
                "risco": f.risco,
                "acao": f.acao,
                "motivo": f.motivo,
            }
        )

    snap = {
        "produto": "Plano de Qualidade de Agentes de Crédito",
        "observacao_carteira": (
            "Prévia no padrão Navigate (agregado por CPF, sem CPF de cliente). "
            "A carteira produzida pelo digitador não vem do Navigate — sem linha "
            "o status é não aplicável e o denominador não é inventado. "
            "Numerador proxy: Procedente - Corban."
        ),
        "ocorrencias": ocorrencias,
        "classificacoes": classificacoes,
        "pontuacoes_mcb": pontuacoes,
        "fraude_104": fraude,
        "excecoes_cpf": [],
    }
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(snap, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"escreveu {SAIDA} ({len(classificacoes)} classificações, {len(ocorrencias)} ocorrências)")


if __name__ == "__main__":
    main()
