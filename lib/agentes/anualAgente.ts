import { mesChave } from "./format.ts";
import type { Classificacao, Fraude104, PontuacaoMcb } from "./snapshot";

export type ResumoAnualAgente = {
  cpf_agente: string;
  cpf_agente_mascarado: string;
  nome_agente: string | null;
  nome_correspondente: string | null;
  ano: number;
  meses: number;
  qtd_reclamacoes: number;
  qtd_acoes: number;
  numerador: number;
  meses_conforme: number;
  meses_nao_conforme: number;
  meses_nao_aplicavel: number;
  pontos_mcb: number;
  suspensao: string | null;
  fraude_risco: string | null;
};

/** Consolida o Quadro 6 mensal + MCB no ano civil. Não cria status anual novo (não é Quadro 3). */
export function consolidarAnoAgente(
  classificacoes: Classificacao[],
  mcb: PontuacaoMcb[],
  fraude: Fraude104[],
  ano: number,
  cpf?: string | null,
): ResumoAnualAgente[] {
  const noAno = classificacoes.filter((c) => Number(mesChave(c.mes_referencia).slice(0, 4)) === ano);
  const recorte = cpf ? noAno.filter((c) => c.cpf_agente === cpf) : noAno;
  const porCpf = new Map<string, Classificacao[]>();
  for (const c of recorte) {
    const lista = porCpf.get(c.cpf_agente) || [];
    lista.push(c);
    porCpf.set(c.cpf_agente, lista);
  }
  const mcbPor = new Map(mcb.map((m) => [m.cpf_agente, m]));
  const fraudePor = new Map(fraude.map((f) => [f.cpf_agente, f]));
  const linhas: ResumoAnualAgente[] = [];
  for (const [cpfAgente, lista] of porCpf) {
    const base = lista[0];
    const m = mcbPor.get(cpfAgente);
    const f = fraudePor.get(cpfAgente);
    linhas.push({
      cpf_agente: cpfAgente,
      cpf_agente_mascarado: base.cpf_agente_mascarado,
      nome_agente: base.nome_agente,
      nome_correspondente: base.nome_correspondente,
      ano,
      meses: lista.length,
      qtd_reclamacoes: lista.reduce((s, r) => s + r.qtd_reclamacoes_total, 0),
      qtd_acoes: lista.reduce((s, r) => s + r.qtd_acoes_judiciais_total, 0),
      numerador: lista.reduce((s, r) => s + r.numerador, 0),
      meses_conforme: lista.filter((r) => r.status === "conforme").length,
      meses_nao_conforme: lista.filter((r) => r.status === "nao_conforme").length,
      meses_nao_aplicavel: lista.filter((r) => r.status === "nao_aplicavel").length,
      pontos_mcb: m?.pontos_vigentes ?? 0,
      suspensao: m?.suspensao ?? null,
      fraude_risco: f?.risco ?? null,
    });
  }
  return linhas.sort(
    (a, b) => b.qtd_reclamacoes - a.qtd_reclamacoes || (a.nome_agente || "").localeCompare(b.nome_agente || "", "pt-BR"),
  );
}

export function anosDisponiveis(meses: string[]): number[] {
  const set = new Set<number>();
  for (const m of meses) {
    const ano = Number(mesChave(m).slice(0, 4));
    if (ano) set.add(ano);
  }
  return [...set].sort((a, b) => b - a);
}
