"""Cria o primeiro usuário staff no Auth e o perfil correspondente.

Usa a service_role (só neste script). Não use essa chave no dashboard.

    python etl/criar_usuario_staff.py --email maria.morais@senff.com.br --senha '...'
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--email", required=True)
    parser.add_argument("--senha", required=True)
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    chave = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not chave:
        raise SystemExit("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env")

    sb = create_client(url, chave)
    user_id = None
    try:
        criado = sb.auth.admin.create_user({
            "email": args.email,
            "password": args.senha,
            "email_confirm": True,
        })
        user_id = criado.user.id
    except Exception:
        listed = sb.auth.admin.list_users()
        users = listed if isinstance(listed, list) else getattr(listed, "users", None) or []
        match = next((u for u in users if getattr(u, "email", None) == args.email), None)
        if match is None:
            raise
        user_id = match.id
        sb.auth.admin.update_user_by_id(user_id, {
            "password": args.senha,
            "email_confirm": True,
        })
    existente = sb.table("perfis").select("id").eq("id", user_id).execute()
    if not existente.data:
        sb.table("perfis").insert({"id": user_id, "role": "staff"}).execute()
    print(f"Usuário staff pronto: {args.email} ({user_id})")
    print("Login no painel: streamlit run dashboard/app.py")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        sys.exit(1)
