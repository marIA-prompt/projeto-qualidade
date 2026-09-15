import type { Classificacao } from "./types";
import { fmtIndice, mesRotulo } from "./format";

export function montarRelatorioMensal(args: {
  mes: string;
  linhas: Classificacao[];
  correspondente?: string | null;
}): { assunto: string; corpo: string } {
  const mesFmt = mesRotulo(args.mes);
  const escopo = args.correspondente || "todos os correspondentes";
  const assunto = `[Senff] Relatório mensal de qualidade — ${mesFmt} — ${escopo}`;
  const linhas = [
    "# Relatório mensal de qualidade de correspondentes",
    "",
    `**Banco Senff** · Plano de Qualidade · mês ${mesFmt}`,
    `**Escopo:** ${escopo}`,
    `**Gerado em:** ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## Resumo",
  ];
  if (!args.linhas.length) {
    linhas.push("Nenhum correspondente classificado neste mês.");
    return { assunto, corpo: linhas.join("\n") };
  }
  const df = args.linhas;
  linhas.push(
    `- Correspondentes: **${df.length}**`,
    `- Não conformes: **${df.filter((r) => r.status === "nao_conforme").length}**`,
    `- Não aplicáveis (sem carteira/corte): **${df.filter((r) => r.status === "nao_aplicavel").length}**`,
    `- Reclamações: **${df.reduce((s, r) => s + r.qtd_reclamacoes, 0)}** (${df.reduce((s, r) => s + r.qtd_reclamacoes_corban, 0)} procedente Corban · ${df.reduce((s, r) => s + r.qtd_reclamacoes_senff, 0)} procedente Senff)`,
    `- Ações judiciais: **${df.reduce((s, r) => s + r.qtd_acoes_judiciais, 0)}** (${df.reduce((s, r) => s + r.qtd_acoes_judiciais_corban, 0)} procedente Corban · ${df.reduce((s, r) => s + r.qtd_acoes_judiciais_senff, 0)} procedente Senff)`,
    `- Em andamento (fora do índice): **${df.reduce((s, r) => s + r.qtd_indefinidas, 0)}**`,
    "",
    "## Por correspondente",
    "",
    "| Correspondente | CNPJ | Reclamações | Ações | Índice | Status |",
    "|---|---|---:|---:|---|---|",
  );
  for (const r of [...df].sort((a, b) => a.correspondente.localeCompare(b.correspondente))) {
    linhas.push(
      `| ${r.correspondente} | ${r.cnpj} | ${r.qtd_reclamacoes} | ${r.qtd_acoes_judiciais} | ${fmtIndice(r.indice)} | ${r.status} |`,
    );
  }
  linhas.push(
    "",
    "## Relacionamento",
    "",
    "A vertente de relacionamento vem antes da sanção: conversa de acompanhamento, reorientação de conduta e notificação. Medidas de suspensão são ato da Gestora de Qualidade — o sistema nunca aplica sanção sozinho.",
    "",
    "— Qualidade e Compliance · Banco Senff",
  );
  return { assunto, corpo: linhas.join("\n") };
}

export function csvFechamento(linhas: Record<string, unknown>[]): string {
  if (!linhas.length) return "";
  const cols = Object.keys(linhas[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [cols.join(","), ...linhas.map((row) => cols.map((c) => esc(row[c])).join(","))].join("\n");
}
