import { ConfiguracaoAusente } from "@/components/ConfiguracaoAusente";
import { ShellAgentes } from "@/components/agentes/ShellAgentes";
import { contextoAgentes } from "@/lib/agentes/contexto";
import { supabasePublicEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function AgentesLayout({ children }: { children: React.ReactNode }) {
  if (!supabasePublicEnv()) {
    return <ConfiguracaoAusente />;
  }
  const ctx = await contextoAgentes();
  if (!ctx.role) {
    return (
      <main className="p-8">
        <p>
          Seu usuário não tem perfil cadastrado. Peça à equipe de Qualidade para inserir
          seu registro na tabela <code>perfis</code>.
        </p>
      </main>
    );
  }
  if (ctx.role !== "staff") {
    return (
      <main className="p-8">
        <p>O Plano de Qualidade de Agentes de Crédito é restrito à área de Qualidade.</p>
      </main>
    );
  }
  return (
    <ShellAgentes email={ctx.email} papel={ctx.role} meses={ctx.meses} agentes={ctx.agentes}>
      {children}
    </ShellAgentes>
  );
}
