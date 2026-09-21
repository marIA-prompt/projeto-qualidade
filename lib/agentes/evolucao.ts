import { mesChave } from "./format.ts";
import type { Classificacao, Ocorrencia } from "./snapshot";

export function serieMensal(
  classificacoes: Classificacao[],
  cpf?: string | null,
): {
  mes: string;
  Reclamações: number;
  "Ações judiciais": number;
  Numerador: number;
  "Não conformes": number;
  "Índice (%)": number | null;
}[] {
  const recorte = cpf ? classificacoes.filter((c) => c.cpf_agente === cpf) : classificacoes;
  const porMes = new Map<string, typeof recorte>();
  for (const c of recorte) {
    const m = mesChave(c.mes_referencia);
    const lista = porMes.get(m) || [];
    lista.push(c);
    porMes.set(m, lista);
  }
  return [...porMes.keys()]
    .sort()
    .map((mes) => {
      const lista = porMes.get(mes) || [];
      const rec = lista.reduce((s, r) => s + r.qtd_reclamacoes_total, 0);
      const aj = lista.reduce((s, r) => s + r.qtd_acoes_judiciais_total, 0);
      const num = lista.reduce((s, r) => s + r.numerador, 0);
      const nc = lista.filter((r) => r.status === "nao_conforme").length;
      const indices = lista.map((r) => r.indice).filter((v): v is number => v != null);
      return {
        mes,
        Reclamações: rec,
        "Ações judiciais": aj,
        Numerador: num,
        "Não conformes": nc,
        "Índice (%)": indices.length === 1 ? indices[0] * 100 : null,
      };
    });
}

export function barrasCanal(
  ocorrencias: Ocorrencia[],
  opts: { mes: string; cpf?: string | null },
): { nome: string; Reclamações: number }[] {
  const mes = mesChave(opts.mes);
  const porCanal = new Map<string, number>();
  for (const o of ocorrencias) {
    if (o.duplicada_unitariedade || o.sem_cpf_agente) continue;
    if (String(o.tipo_ocorrencia) !== "4") continue;
    if (mes && mesChave(o.mes_referencia) !== mes) continue;
    if (opts.cpf && o.cpf_agente !== opts.cpf) continue;
    const canal = (o.canal_origem || "Sem canal").trim() || "Sem canal";
    porCanal.set(canal, (porCanal.get(canal) || 0) + 1);
  }
  return [...porCanal.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([nome, n]) => ({ nome, Reclamações: n }));
}

export function topAgentesMes(
  linhas: Classificacao[],
  n = 10,
): { nome: string; Reclamações: number; "Ações judiciais": number }[] {
  return [...linhas]
    .sort(
      (a, b) =>
        b.qtd_reclamacoes_total - a.qtd_reclamacoes_total ||
        b.qtd_acoes_judiciais_total - a.qtd_acoes_judiciais_total,
    )
    .slice(0, n)
    .map((r) => ({
      nome: r.nome_agente || r.cpf_agente_mascarado,
      Reclamações: r.qtd_reclamacoes_total,
      "Ações judiciais": r.qtd_acoes_judiciais_total,
    }));
}
