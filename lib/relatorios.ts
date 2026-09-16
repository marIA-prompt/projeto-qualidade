import type { Alerta } from "./alertas";
import type { Classificacao } from "./types";
import {
  assuntoRelatorio,
  montarDadosRelatorio,
  relatorioMarkdown,
  type MedidaHistorico,
} from "./relatorioModelo";

export function montarRelatorioMensal(args: {
  mes: string;
  linhas: Classificacao[];
  correspondente?: string | null;
  hist?: Classificacao[];
  alertas?: Alerta[];
  medidas?: MedidaHistorico[];
  geradoEm?: string;
}): { assunto: string; corpo: string } {
  const dados = montarDadosRelatorio(args);
  return { assunto: assuntoRelatorio(dados), corpo: relatorioMarkdown(dados) };
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
