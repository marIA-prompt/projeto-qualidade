"""Acesso a dados do dashboard — sempre via `anon key` + usuário autenticado,
respeitando o RLS definido em `supabase_schema_rls.sql`. Nenhuma função aqui
decide classificação regulatória; elas só leem/gravam o que já existe.
"""

from __future__ import annotations

from typing import Optional

import pandas as pd
from supabase import Client


def buscar_perfil(client: Client, usuario_id: str) -> Optional[dict]:
    resposta = client.table("perfis").select("papel,correspondente_id").eq("id", usuario_id).execute()
    linhas = resposta.data or []
    return linhas[0] if linhas else None


def listar_correspondentes(client: Client) -> pd.DataFrame:
    """Para staff, retorna todos os correspondentes (RLS libera). Para um
    usuário `correspondente`, o RLS já restringe à própria linha."""
    resposta = client.table("correspondentes").select("id,cnpj,nome").order("nome").execute()
    return pd.DataFrame(resposta.data or [], columns=["id", "cnpj", "nome"])


def buscar_ocorrencias_mes(client: Client, tabela: str, correspondente_ids: list[str], mes_referencia: str) -> pd.DataFrame:
    if not correspondente_ids:
        return pd.DataFrame()
    resposta = (
        client.table(tabela)
        .select("*")
        .in_("correspondente_id", correspondente_ids)
        .eq("mes_referencia", mes_referencia)
        .execute()
    )
    return pd.DataFrame(resposta.data or [])


def buscar_classificacoes_mes(client: Client, correspondente_ids: list[str], mes_referencia: str) -> pd.DataFrame:
    if not correspondente_ids:
        return pd.DataFrame()
    resposta = (
        client.table("classificacoes_mensais")
        .select("*")
        .in_("correspondente_id", correspondente_ids)
        .eq("mes_referencia", mes_referencia)
        .execute()
    )
    return pd.DataFrame(resposta.data or [])


def listar_medidas_administrativas(client: Client) -> pd.DataFrame:
    resposta = client.table("medidas_administrativas").select("*").order("nivel").execute()
    return pd.DataFrame(resposta.data or [])


def listar_medidas_aplicadas(client: Client, correspondente_id: str) -> pd.DataFrame:
    resposta = (
        client.table("medidas_aplicadas")
        .select("*, medidas_administrativas(descricao,nivel)")
        .eq("correspondente_id", correspondente_id)
        .order("aplicada_em", desc=True)
        .execute()
    )
    return pd.DataFrame(resposta.data or [])


def registrar_medida_aplicada(
    client: Client,
    correspondente_id: str,
    medida_id: int,
    classificacao_mensal_id: Optional[str],
    motivo: str,
    observacoes: str,
    aplicada_por: str,
) -> None:
    """FR-11: registro manual da medida administrativa aplicada. Sempre um
    ato humano — este módulo só grava a decisão, não a sugere nem a decide.
    """
    client.table("medidas_aplicadas").insert(
        {
            "correspondente_id": correspondente_id,
            "medida_id": medida_id,
            "classificacao_mensal_id": classificacao_mensal_id,
            "motivo": motivo,
            "observacoes": observacoes,
            "aplicada_por": aplicada_por,
        }
    ).execute()
