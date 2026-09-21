import { GraficoBarras } from "@/components/Charts";
import { TabelaQuadro6 } from "@/components/agentes/TabelaQuadro6";
import { Kpis } from "@/components/ui";
import { contextoAgentes } from "@/lib/agentes/contexto";

export default async function FechamentoAgentesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cpf?: string }>;
}) {
  const { mes, cpf } = await searchParams;
  const ctx = await contextoAgentes(mes, cpf);
  const { df } = ctx;
  const top = [...df]
    .sort((a, b) => b.qtd_reclamacoes_total - a.qtd_reclamacoes_total)
    .slice(0, 10)
    .map((r) => ({
      nome: r.nome_agente || r.cpf_agente_mascarado,
      Reclamações: r.qtd_reclamacoes_total,
      "Ações judiciais": r.qtd_acoes_judiciais_total,
    }));

  return (
    <section className="space-y-4">
      <p className="text-sm text-[var(--senff-navy-text)]">
        Fechamento mensal do <strong>Quadro 6</strong> (arts. 11 e 12). Índice =
        (reclamações procedentes + ações judiciais procedentes) ÷ carteira do
        agente desde jan/2023. Aplicável só se ops &gt; 50 <strong>e</strong>{" "}
        reclamações &gt; 1. Teto 0,75% inclusivo na conformidade.
      </p>
      <Kpis
        cards={[
          { label: "Agentes", value: String(df.length), tone: "acqua" },
          { label: "Conformes", value: String(df.filter((r) => r.status === "conforme").length), tone: "navy" },
          { label: "Não conformes", value: String(df.filter((r) => r.status === "nao_conforme").length), tone: "sky" },
          { label: "Não aplicáveis", value: String(df.filter((r) => r.status === "nao_aplicavel").length), tone: "warn" },
        ]}
      />
      <TabelaQuadro6
        mes={ctx.mes}
        linhas={[...df]
          .sort(
            (a, b) =>
              b.qtd_reclamacoes_total - a.qtd_reclamacoes_total ||
              b.qtd_acoes_judiciais_total - a.qtd_acoes_judiciais_total,
          )
          .map((r) => ({
            cpf: r.cpf_agente,
            nome: r.nome_agente || r.cpf_agente_mascarado,
            mascara: r.cpf_agente_mascarado,
            corban: r.nome_correspondente || "—",
            rec: r.qtd_reclamacoes_total,
            aj: r.qtd_acoes_judiciais_total,
            num: r.numerador,
            cart: r.carteira_denominador ?? "—",
            idx: r.indice,
            status: r.status,
          }))}
      />
      <h3 className="font-semibold">Ocorrências por agente (top 10)</h3>
      {top.length ? (
        <GraficoBarras
          data={top}
          series={[
            { key: "Reclamações", color: "#05aaca" },
            { key: "Ações judiciais", color: "#112369" },
          ]}
        />
      ) : (
        <p className="text-sm">Sem ocorrências neste recorte.</p>
      )}
    </section>
  );
}
