"""Autenticação do dashboard via Supabase Auth.

Importante: o client aqui é guardado em `st.session_state` (por sessão de
navegador), **não** em `st.cache_resource`. `st.cache_resource` compartilha o
mesmo objeto entre TODOS os usuários do processo Streamlit — se fizéssemos
login nele, o token de autenticação de um usuário vazaria para a sessão de
outro. Cada aba/usuário precisa do seu próprio client autenticado.
"""

from __future__ import annotations

import os

import streamlit as st
from supabase import Client, create_client


class ConfiguracaoAusente(RuntimeError):
    pass


def obter_client() -> Client:
    if "supabase_client" in st.session_state:
        return st.session_state["supabase_client"]

    url = os.environ.get("SUPABASE_URL")
    chave = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not chave:
        raise ConfiguracaoAusente(
            "SUPABASE_URL e SUPABASE_ANON_KEY precisam estar definidas. Veja .env.example."
        )

    client = create_client(url, chave)
    st.session_state["supabase_client"] = client
    return client


def autenticar(client: Client, email: str, senha: str):
    resposta = client.auth.sign_in_with_password({"email": email, "password": senha})
    return resposta.user


def sair(client: Client) -> None:
    try:
        client.auth.sign_out()
    finally:
        for chave in ("usuario", "perfil"):
            st.session_state.pop(chave, None)
