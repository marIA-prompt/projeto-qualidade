export function mesIso(valor: unknown): string {
  return String(valor ?? "").slice(0, 10);
}

export function mesRotulo(valor: unknown): string {
  return mesIso(valor).slice(0, 7);
}

export function fmtIndice(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(4)}%`;
}

export const ROTULOS_STATUS: Record<string, string> = {
  conforme: "Conforme",
  parcialmente_conforme: "Parcialmente conforme",
  em_atencao: "Em atenção",
  nao_conforme: "Não conforme",
  nao_aplicavel: "Não aplicável",
};

export const ROTULOS_SEV: Record<string, string> = {
  critico: "Crítico",
  atencao: "Atenção",
  info: "Info",
};
