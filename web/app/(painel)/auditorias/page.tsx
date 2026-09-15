import { FormAuditoria } from "@/components/FormAuditoria";
import { Tabela } from "@/components/ui";
import { carregarPerfil } from "@/lib/dados";
import { PILARES } from "@/lib/pilares";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { perfil } = await carregarPerfil();
  const sb = await createClient();
  const { data: cors } = await sb.from("correspondentes").select("id, nome, cnpj").order("nome");
  const blocos: Record<string, unknown>[] = [];
  for (const [rotulo, tabela] of [
    ["Auditoria externa", "auditorias_externas"],
    ["Auditoria interna", "auditorias_internas"],
  ] as const) {
    const { data } = await sb
      .from(tabela)
      .select("data_avaliacao, pilar, pontuacao, observacoes, correspondentes(nome)")
      .order("data_avaliacao", { ascending: false })
      .limit(15);
    for (const r of data || []) {
      const corr = r.correspondentes as { nome?: string } | null;
      blocos.push({
        Tipo: rotulo,
        Data: r.data_avaliacao,
        Correspondente: corr?.nome || "—",
        Pilar: PILARES[r.pilar] || r.pilar,
        Pontuação: r.pontuacao ?? "—",
        Observações: r.observacoes || "—",
      });
    }
  }
  blocos.sort((a, b) => String(b.Data).localeCompare(String(a.Data)));

  return (
    <section className="space-y-4">
      {perfil?.role === "staff" ? (
        <FormAuditoria correspondentes={cors || []} />
      ) : (
        <p className="text-sm">Somente a área de Qualidade registra auditorias.</p>
      )}
      <h3 className="font-semibold">Últimos registros</h3>
      {blocos.length ? (
        <Tabela
          colunas={[
            { chave: "Tipo", titulo: "Tipo" },
            { chave: "Data", titulo: "Data" },
            { chave: "Correspondente", titulo: "Correspondente" },
            { chave: "Pilar", titulo: "Pilar" },
            { chave: "Pontuação", titulo: "Pontuação" },
            { chave: "Observações", titulo: "Observações" },
          ]}
          linhas={blocos}
        />
      ) : (
        <p className="text-sm">Nenhuma auditoria registrada ainda.</p>
      )}
    </section>
  );
}
