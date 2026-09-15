"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function BotaoSair() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="w-full rounded-[var(--radius-form)] border border-white/25 bg-white/10 px-3 py-2 text-sm text-white hover:bg-[var(--senff-acqua)] hover:border-[var(--senff-acqua)]"
      onClick={async () => {
        const sb = createBrowserSupabase();
        await sb.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Sair
    </button>
  );
}
