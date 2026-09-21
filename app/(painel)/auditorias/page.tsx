import { FormAuditoria } from "@/components/FormAuditoria";
import { ListaAuditorias, type LinhaAuditoria } from "@/components/ListaAuditorias";
import { carregarPerfil } from "@/lib/dados";
import { caminhoAnexoAuditoria } from "@/lib/auditoriaAnexo";
import { formatarPontuacao, PILARES } from "@/lib/pilares";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { perfil } = await carregarPerfil();
  const sb = await createClient();
  const { data: cors } = await sb.from("correspondentes").select("id, nome, cnpj").order("nome");
  const blocos: LinhaAuditoria[] = [];
  for (const [rotulo, tabela] of [
    ["Auditoria externa", "auditorias_externas"],
    ["Auditoria interna", "auditorias_internas"],
  ] as const) {
    const { data } = await sb
      .from(tabela)
      .select("id, data_avaliacao, pilar, pontuacao, observacoes, correspondentes(nome)")
      .order("data_avaliacao", { ascending: false })
      .limit(50);
    for (const r of data || []) {
      const corr = r.correspondentes as { nome?: string } | null;
      const obs = r.observacoes || "";
      const semAnexo = obs
        .replace(/^Anexo PDF:\s+\S+\n?/m, "")
        .replace(/^Anexo PDF \(não enviado ao storage\):.*$/m, "")
        .trim();
      blocos.push({
        id: r.id,
        tabela,
        Tipo: rotulo,
        Data: r.data_avaliacao,
        Correspondente: corr?.nome || "—",
        Pilar: PILARES[r.pilar] || r.pilar,
        Pontuação: formatarPontuacao(r.pontuacao),
        Observações: semAnexo || "—",
        Anexo: caminhoAnexoAuditoria(obs) ? "PDF" : "—",
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
        <ListaAuditorias linhas={blocos} ehStaff={perfil?.role === "staff"} />
      ) : (
        <p className="text-sm">Nenhuma auditoria registrada ainda.</p>
      )}
    </section>
  );
}
