import { ConfiguracaoAusente } from "@/components/ConfiguracaoAusente";
import { Shell } from "@/components/ui";
import { contextoPainel } from "@/lib/contexto";
import { supabasePublicEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  if (!supabasePublicEnv()) {
    return <ConfiguracaoAusente />;
  }
  const ctx = await contextoPainel();
  if (!ctx.perfil) {
    return (
      <main className="p-8">
        <p>
          Seu usuário não tem perfil cadastrado. Peça à equipe de Qualidade para inserir
          seu registro na tabela <code>perfis</code>.
        </p>
      </main>
    );
  }
  return (
    <Shell email={ctx.email} papel={ctx.perfil.role} meses={ctx.meses}>
      {children}
    </Shell>
  );
}
