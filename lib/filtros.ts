export const TOP_OCORRENCIAS_GRAFICO = 10;
export const CHAVE_ACOMPANHAMENTO_FILA = "fila";

function mesChave(valor: unknown): string {
  return String(valor ?? "").slice(0, 10);
}

export type CorrespondenteOpcao = { id: string; nome: string };

export function correspondentesDoHistorico(
  hist: { correspondente_id: string; correspondente: string }[],
): CorrespondenteOpcao[] {
  const map = new Map<string, string>();
  for (const h of hist) {
    if (!h.correspondente_id) continue;
    if (!map.has(h.correspondente_id)) map.set(h.correspondente_id, h.correspondente);
  }
  return [...map.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
    .map(([id, nome]) => ({ id, nome }));
}

export function corbanValido(
  corban: string | null | undefined,
  opcoes: CorrespondenteOpcao[],
): string | null {
  if (!corban) return null;
  return opcoes.some((c) => c.id === corban) ? corban : null;
}

export function filtrarCorban<T extends { correspondente_id: string }>(
  linhas: T[],
  corban?: string | null,
): T[] {
  if (!corban) return linhas;
  return linhas.filter((l) => l.correspondente_id === corban);
}

export function queryPainel(atual: { mes?: string | null; corban?: string | null }): string {
  const p = new URLSearchParams();
  if (atual.mes) p.set("mes", atual.mes);
  if (atual.corban) p.set("corban", atual.corban);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function chaveAcompanhamentoConversa(tipo: string): string {
  return `conversa:${tipo}`;
}

export function chaveAcompanhamentoValida(chave: string): boolean {
  return chave === CHAVE_ACOMPANHAMENTO_FILA || chave.startsWith("conversa:");
}

export function topOcorrencias(
  linhas: { correspondente: string; qtd_reclamacoes: number; qtd_acoes_judiciais: number }[],
  n = TOP_OCORRENCIAS_GRAFICO,
): { nome: string; Reclamações: number; "Ações judiciais": number }[] {
  return [...linhas]
    .sort((a, b) => b.qtd_reclamacoes - a.qtd_reclamacoes || b.qtd_acoes_judiciais - a.qtd_acoes_judiciais)
    .slice(0, n)
    .map((r) => ({
      nome: r.correspondente,
      Reclamações: r.qtd_reclamacoes,
      "Ações judiciais": r.qtd_acoes_judiciais,
    }));
}

export function barrasCanal(
  recs: { canal_origem?: string | null; mes_referencia?: string | null; correspondente_id?: string | null }[],
  opts: { mes: string; corban?: string | null },
): { nome: string; Reclamações: number }[] {
  const porCanal = new Map<string, number>();
  const mes = mesChave(opts.mes);
  for (const r of recs) {
    if (mes && mesChave(r.mes_referencia) !== mes) continue;
    if (opts.corban && r.correspondente_id !== opts.corban) continue;
    const canal = (r.canal_origem || "Sem canal").trim() || "Sem canal";
    porCanal.set(canal, (porCanal.get(canal) || 0) + 1);
  }
  return [...porCanal.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([nome, n]) => ({ nome, Reclamações: n }));
}

export function serieRede(
  hist: {
    mes_referencia: string;
    qtd_reclamacoes: number;
    qtd_acoes_judiciais: number;
    numerador: number;
    status: string;
    indice: number | null;
  }[],
): {
  mes: string;
  Reclamações: number;
  "Ações judiciais": number;
  Numerador: number;
  "Não conformes": number;
  "Índice (%)": number | null;
}[] {
  const porMes = new Map<
    string,
    {
      Reclamações: number;
      "Ações judiciais": number;
      Numerador: number;
      "Não conformes": number;
      indiceSoma: number;
      indiceN: number;
    }
  >();
  for (const r of hist) {
    const k = r.mes_referencia.slice(0, 7);
    const cur = porMes.get(k) || {
      Reclamações: 0,
      "Ações judiciais": 0,
      Numerador: 0,
      "Não conformes": 0,
      indiceSoma: 0,
      indiceN: 0,
    };
    cur.Reclamações += r.qtd_reclamacoes;
    cur["Ações judiciais"] += r.qtd_acoes_judiciais;
    cur.Numerador += r.numerador;
    if (r.status === "nao_conforme") cur["Não conformes"] += 1;
    if (r.indice != null) {
      cur.indiceSoma += r.indice;
      cur.indiceN += 1;
    }
    porMes.set(k, cur);
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({
      mes,
      Reclamações: v.Reclamações,
      "Ações judiciais": v["Ações judiciais"],
      Numerador: v.Numerador,
      "Não conformes": v["Não conformes"],
      "Índice (%)": v.indiceN ? Math.round((v.indiceSoma / v.indiceN) * 1000000) / 10000 : null,
    }));
}
