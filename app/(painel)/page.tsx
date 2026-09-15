import { Kpis } from "@/components/ui";
import { TabelaQuadro5 } from "@/components/TabelaQuadro5";
import { contextoPainel } from "@/lib/contexto";

export default async function VisaoGeral({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const { df } = await contextoPainel(mes);
  if (!df.length) {
    return <p>Nenhum mês processado ainda. Rode o ETL de reclamações.</p>;
  }
  const rec = df.reduce((s, r) => s + r.qtd_reclamacoes, 0);
  const recC = df.reduce((s, r) => s + r.qtd_reclamacoes_corban, 0);
  const recS = df.reduce((s, r) => s + r.qtd_reclamacoes_senff, 0);
  const aj = df.reduce((s, r) => s + r.qtd_acoes_judiciais, 0);
  const ajC = df.reduce((s, r) => s + r.qtd_acoes_judiciais_corban, 0);
  const ajS = df.reduce((s, r) => s + r.qtd_acoes_judiciais_senff, 0);
  const andamento = df.reduce((s, r) => s + r.qtd_indefinidas, 0);

  return (
    <>
      <Kpis
        cards={[
          {
            label: "Reclamações",
            value: String(rec),
            hint: `${recC} procedente Corban · ${recS} procedente Senff`,
            tone: "acqua",
          },
          {
            label: "Ações judiciais",
            value: String(aj),
            hint: `${ajC} procedente Corban · ${ajS} procedente Senff`,
            tone: "navy",
          },
          {
            label: "Em andamento",
            value: String(andamento),
            hint: "sem classificação final Corban/Senff",
            tone: "warn",
          },
        ]}
      />
      <TabelaQuadro5
        linhas={df.map((r) => ({
          c: r.correspondente,
          cnpj: r.cnpj,
          rec: `${r.qtd_reclamacoes} (${r.qtd_reclamacoes_corban} Corban · ${r.qtd_reclamacoes_senff} Senff)`,
          aj: `${r.qtd_acoes_judiciais} (${r.qtd_acoes_judiciais_corban} Corban · ${r.qtd_acoes_judiciais_senff} Senff)`,
          status: r.status,
        }))}
      />
    </>
  );
}
