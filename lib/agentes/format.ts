export function mesChave(valor: unknown): string {
  return String(valor ?? "").slice(0, 7);
}

export function mesIso(valor: unknown): string {
  const t = String(valor ?? "");
  if (/^\d{4}-\d{2}$/.test(t)) return `${t}-01`;
  return t.slice(0, 10);
}

export function mesRotulo(valor: unknown): string {
  return mesChave(valor);
}

export function fmtIndice(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(4)}%`;
}

export function fmtCpfCompleto(cpf: string): string {
  const d = cpf.replace(/\D/g, "").padStart(11, "0").slice(-11);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function mascararCpf(cpf: string | null | undefined): string {
  const d = String(cpf ?? "").replace(/\D/g, "");
  if (d.length < 2) return "***.***.***-**";
  return `***.***.***-${d.slice(-2)}`;
}

export const ROTULOS_STATUS: Record<string, string> = {
  conforme: "Conforme",
  nao_conforme: "Não conforme",
  nao_aplicavel: "Não aplicável",
};

export const ROTULOS_RISCO: Record<string, string> = {
  baixo: "Baixo",
  moderado: "Moderado",
  alto: "Alto",
};

export const ROTULOS_ACAO_104: Record<string, string> = {
  monitoramento_1: "Monitoramento 1",
  monitoramento_2: "Monitoramento 2",
  suspensao_definitiva: "Suspensão definitiva",
};

export const ROTULOS_SUSPENSAO: Record<string, string> = {
  temporaria: "Suspensão temporária",
  definitiva: "Suspensão definitiva",
};
