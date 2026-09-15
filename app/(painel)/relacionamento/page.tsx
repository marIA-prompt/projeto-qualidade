import { Tabela } from "@/components/ui";
import { acaoRelacionamento } from "@/lib/alertas";
import { contextoPainel } from "@/lib/contexto";
import { PILARES, SUBCRITERIOS } from "@/lib/pilares";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const { df, alertas } = await contextoPainel(mes);
  const sb = await createClient();
  const { data: aplicadas } = await sb
    .from("medidas_aplicadas")
    .select("correspondente_id, data_aplicacao, motivo, medidas_administrativas(nivel, descricao)")
    .order("data_aplicacao", { ascending: false });
  const ultimaPorCorr = new Map<string, { acao: string; data: string }>();
  for (const m of aplicadas || []) {
    if (!m.correspondente_id || ultimaPorCorr.has(m.correspondente_id)) continue;
    const med = m.medidas_administrativas as { nivel?: number; descricao?: string } | null;
    const acao = med?.nivel
      ? `Nível ${med.nivel} — ${med.descricao || "—"}`
      : med?.descricao || m.motivo || "Medida registrada";
    ultimaPorCorr.set(m.correspondente_id, { acao, data: m.data_aplicacao || "—" });
  }

  const rel = alertas.filter((a) =>
    ["relacionamento", "volume_reclamacoes", "nao_conforme"].includes(a.tipo),
  );
  const abertos = rel.filter((a) => !ultimaPorCorr.has(a.correspondente_id));
  const ranking = [...df]
    .sort((a, b) => b.qtd_reclamacoes - a.qtd_reclamacoes)
    .slice(0, 10)
    .map((r) => {
      const feita = ultimaPorCorr.get(r.correspondente_id);
      return {
        c: r.correspondente,
        cnpj: r.cnpj,
        rec: r.qtd_reclamacoes,
        canal: r.canal_mais_frequente || "—",
        status: r.status,
        passo: feita
          ? "Concluído"
          : acaoRelacionamento(alertas.filter((a) => a.correspondente === r.correspondente)),
        acao: feita?.acao || "—",
        data: feita?.data || "—",
      };
    });

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Vertente de relacionamento</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        Qualidade de Correspondentes não é só índice e sanção. O pilar{" "}
        <strong>{PILARES.relacionamento_cliente}</strong> avalia clareza, linguagem, atendimento,
        respeito ao consumidor e oferta responsável. A conversa vem antes da medida punitiva.
        Registrar a medida em Medidas administrativas conclui o item aqui.
      </p>
      <ul className="list-disc pl-5 text-sm">
        {Object.values(SUBCRITERIOS.relacionamento_cliente).map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <h3 className="font-semibold">Onde o relacionamento pede conversa neste mês</h3>
      {abertos.length ? (
        <Tabela
          colunas={[
            { chave: "c", titulo: "Correspondente" },
            { chave: "m", titulo: "Mensagem" },
            { chave: "acao", titulo: "Ação realizada" },
            { chave: "data", titulo: "Data" },
          ]}
          linhas={abertos.map((a) => ({
            c: a.correspondente,
            m: a.mensagem,
            acao: "—",
            data: "—",
          }))}
        />
      ) : (
        <p>Nenhum correspondente com conversa de relacionamento em aberto neste mês.</p>
      )}
      <h3 className="font-semibold">Fila de acompanhamento (top 10 em reclamações)</h3>
      <Tabela
        colunas={[
          { chave: "c", titulo: "Correspondente" },
          { chave: "cnpj", titulo: "CNPJ" },
          { chave: "rec", titulo: "Reclamações" },
          { chave: "canal", titulo: "Canal" },
          { chave: "status", titulo: "Status" },
          { chave: "passo", titulo: "Próximo passo" },
          { chave: "acao", titulo: "Ação realizada" },
          { chave: "data", titulo: "Data" },
        ]}
        linhas={ranking}
      />
    </section>
  );
}
