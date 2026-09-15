import { Shell } from "@/components/ui";
import { contextoPainel } from "@/lib/contexto";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
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
