"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [pendente, setPendente] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro("");
    setPendente(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");
    let sb;
    try {
      sb = createBrowserSupabase();
    } catch {
      setPendente(false);
      setErro(
        "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY não estão neste deploy. Configure na Vercel e faça Redeploy.",
      );
      return;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setPendente(false);
    if (error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium">
        E-mail
        <input
          name="email"
          type="email"
          defaultValue="maria.morais@senff.com.br"
          required
          className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="block text-sm font-medium">
        Senha
        <input
          name="password"
          type="password"
          required
          className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
        />
      </label>
      {erro ? <p className="text-sm text-[var(--danger)]">{erro}</p> : null}
      <button
        type="submit"
        disabled={pendente}
        className="w-full rounded-[var(--radius-form)] bg-[var(--senff-acqua)] px-4 py-2 font-semibold text-white hover:bg-[var(--senff-acqua-hover)] disabled:opacity-60"
      >
        {pendente ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-xs text-[var(--senff-grey)]">
        Acesso interno · Qualidade e Compliance · Banco Senff
      </p>
    </form>
  );
}
