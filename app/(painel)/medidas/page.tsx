import { FormMedida } from "@/components/FormMedida";
import { Tabela } from "@/components/ui";
import { contextoPainel } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const ctx = await contextoPainel(mes);
  const sb = await createClient();
  if (ctx.perfil?.role !== "staff") {
    return <p className="text-sm">Somente a área de Qualidade registra medidas administrativas.</p>;
  }
  const { data: medidas } = await sb.from("medidas_administrativas").select("*").order("id");
  const { data: cors } = await sb.from("correspondentes").select("id, nome, cnpj").order("nome");
  const { data: aplicadas } = await sb
    .from("medidas_aplicadas")
    .select("data_aplicacao, motivo, correspondentes(nome), medidas_administrativas(nivel, descricao)")
    .order("data_aplicacao", { ascending: false })
    .limit(20);
  const classifPorCorr: Record<string, string> = {};
  for (const r of ctx.df) classifPorCorr[r.correspondente_id] = r.id;

  return (
    <section className="space-y-4">
      <FormMedida
        correspondentes={cors || []}
        medidas={medidas || []}
        classifPorCorr={classifPorCorr}
      />
      <h3 className="font-semibold">Últimas medidas registradas</h3>
      {aplicadas?.length ? (
        <Tabela
          colunas={[
            { chave: "Data", titulo: "Data" },
            { chave: "Correspondente", titulo: "Correspondente" },
            { chave: "Medida", titulo: "Medida" },
            { chave: "Motivo", titulo: "Motivo" },
          ]}
          linhas={(aplicadas || []).map((m) => {
            const corr = m.correspondentes as { nome?: string } | null;
            const med = m.medidas_administrativas as { nivel?: number; descricao?: string } | null;
            const desc = med?.nivel
              ? `Nível ${med.nivel} — ${med.descricao || "—"}`
              : med?.descricao || "—";
            return {
              Data: m.data_aplicacao,
              Correspondente: corr?.nome || "—",
              Medida: desc,
              Motivo: m.motivo || "—",
            };
          })}
        />
      ) : (
        <p className="text-sm">Nenhuma medida registrada ainda.</p>
      )}
    </section>
  );
}
