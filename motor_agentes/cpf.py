"""Normalização e máscara de CPF (chave do agente).

CPF de cliente nunca entra na UI. CPF do agente é a chave — mascarar em
logs e, na UI, mascarar parcialmente salvo tela staff que precise do completo.
"""

from __future__ import annotations

import re

_SO_DIGITOS = re.compile(r"\D+")


def normalizar_cpf(valor: object) -> str | None:
    """Devolve 11 dígitos ou None. Não inventa CPF; vazio/inválido → None."""
    if valor is None:
        return None
    texto = str(valor).strip()
    if not texto or texto.lower() in {"nan", "none", "null", "-"}:
        return None
    digitos = _SO_DIGITOS.sub("", texto)
    if not digitos:
        return None
    if len(digitos) > 11:
        return None
    return digitos.zfill(11)


def mascarar_cpf(valor: object) -> str:
    """Máscara parcial: ***.***.***-99 (últimos 2 dígitos)."""
    cpf = normalizar_cpf(valor)
    if cpf is None:
        return "***.***.***-**"
    return f"***.***.***-{cpf[-2:]}"


def cpf_para_log(valor: object) -> str:
    """Forma segura para logs — nunca o CPF completo."""
    return mascarar_cpf(valor)
