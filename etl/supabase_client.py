"""Helper para instanciar o client Supabase usado pelo ETL.

O ETL roda fora do contexto de um usuário logado (script sob demanda,
disparado pelo analista ou por um agendador), então ele usa a
`service_role key` — a única peça do sistema autorizada a ignorar RLS e
escrever em massa nas tabelas de fato. Nunca importe este módulo a partir do
dashboard.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from supabase import Client, create_client


class ConfiguracaoAusente(RuntimeError):
    """Levantado quando SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não estão configuradas."""


def obter_client_service_role() -> Client:
    load_dotenv()

    url = os.environ.get("SUPABASE_URL")
    chave = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not chave:
        raise ConfiguracaoAusente(
            "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidas "
            "(arquivo .env local ou secret no ambiente). Veja .env.example."
        )

    return create_client(url, chave)
