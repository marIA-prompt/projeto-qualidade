"""Motor determinístico do Plano de Qualidade de Agentes de Crédito."""

from motor_agentes.classificacao import (
    LIMITE_INDICE_QUADRO6,
    classificar_mensal_agente,
)
from motor_agentes.cpf import mascarar_cpf, normalizar_cpf
from motor_agentes.fraude import classificar_fraude_104
from motor_agentes.mcb import avaliar_mcb

__all__ = [
    "LIMITE_INDICE_QUADRO6",
    "avaliar_mcb",
    "classificar_fraude_104",
    "classificar_mensal_agente",
    "mascarar_cpf",
    "normalizar_cpf",
]
