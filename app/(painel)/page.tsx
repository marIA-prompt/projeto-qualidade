import { Chip, Kpis, Tabela } from "@/components/ui";
import { contextoPainel } from "@/lib/contexto";

export default async function QuatroIndicadores({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const { df, resumo } = await contextoPainel(mes);
  if (!df.length) {
    return <p>Nenhum mês processado ainda. Rode o ETL de reclamações.</p>;
  }
  const rec = df.reduce((s, r) => s + r.qtd_reclamacoes, 0);
  const recC = df.reduce((s, r) => s + r.qtd_reclamacoes_corban, 0);
  const aj = df.reduce((s, r) => s + r.qtd_acoes_judiciais, 0);
  const ajC = df.reduce((s, r) => s + r.qtd_acoes_judiciais_corban, 0);
  const indef = df.reduce((s, r) => s + r.qtd_indefinidas, 0);
  const ext = resumo.filter((r) => r.tipo === "Auditoria externa" && r.data).length;
  const inte = resumo.filter((r) => r.tipo === "Auditoria interna" && r.data).length;

  const aud = (cid: string, tipo: string) => {
    const row = resumo.find((r) => r.correspondente_id === cid && r.tipo === tipo);
    if (!row?.data) return "sem registro";
    const media = row.media == null ? "—" : String(row.media);
    return `${row.data} · ${row.pilares}/5 pilares · média ${media}`;
  };

  return (
    <>
      <Kpis
        cards={[
          { label: "1. Reclamações", value: String(rec), hint: `${recC} procedentes-Corban`, tone: "acqua" },
          { label: "2. Ações judiciais", value: String(aj), hint: `${ajC} procedentes-Corban`, tone: "navy" },
          { label: "3-4. Auditorias", value: String(ext + inte), hint: `${ext} externas · ${inte} internas`, tone: "sky" },
          { label: "Pendências", value: String(indef), hint: "sem atribuição Corban/Senff", tone: "warn" },
        ]}
      />
      <p className="flex flex-wrap gap-2 text-sm">
        <span className="chip chip-ok">Conforme &lt; 0,03%</span>
        <span className="chip chip-danger">Não conforme ≥ 0,03%</span>
        <span className="chip chip-off">Não aplicável — sem carteira</span>
      </p>
      <Tabela
        colunas={[
          { chave: "c", titulo: "Correspondente" },
          { chave: "cnpj", titulo: "CNPJ" },
          { chave: "rec", titulo: "1. Reclamações" },
          { chave: "aj", titulo: "2. Ações judiciais" },
          { chave: "ext", titulo: "3. Auditoria externa" },
          { chave: "int", titulo: "4. Auditoria interna" },
          { chave: "status", titulo: "Status mensal (Quadro 5)" },
        ]}
        linhas={df.map((r) => ({
          c: r.correspondente,
          cnpj: r.cnpj,
          rec: `${r.qtd_reclamacoes} (${r.qtd_reclamacoes_corban} proc.-Corban)`,
          aj: `${r.qtd_acoes_judiciais} (${r.qtd_acoes_judiciais_corban} proc.-Corban)`,
          ext: aud(r.correspondente_id, "Auditoria externa"),
          int: aud(r.correspondente_id, "Auditoria interna"),
          status: <Chip status={r.status} />,
        }))}
      />
      <p className="text-sm text-[var(--senff-navy-text)]">
        Auditorias: última data de avaliação e média dos pilares gravados nesse dia.
        A classificação anual (Quadro 3) ainda não é calculada automaticamente.
      </p>
    </>
  );
}
