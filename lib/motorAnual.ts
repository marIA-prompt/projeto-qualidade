/** Motor Quadro 3 (art. 5º, Anexo I) — classificação anual dos correspondentes. */

export type StatusAnual =
  | "conforme"
  | "parcialmente_conforme"
  | "em_atencao"
  | "nao_conforme"
  | "nao_aplicavel";

export type ResultadoAnual = {
  status: StatusAnual;
  aplicavel: boolean;
  pontuacao: number | null;
  motivo: string;
};

export const STATUS_ANUAL_LABELS: Record<StatusAnual, string> = {
  conforme: "Conforme",
  parcialmente_conforme: "Parcialmente conforme",
  em_atencao: "Em atenção",
  nao_conforme: "Não conforme",
  nao_aplicavel: "Sem avaliação",
};

export const DESVIOS_GRAVES = [
  "Solicitar senha do cliente",
  "Compartilhar base de clientes sem autorização",
  "Digitar proposta para parceiros sem certificação",
] as const;

/** Faixas do plano Senff. >90% sem desvio grave = Conforme (o PDF grafava Em Atenção nas duas colunas). */
export const FAIXAS_ANUAL = [
  { rotulo: "≥ 90%", min: 90, max: null as number | null, sem: "conforme" as StatusAnual, com: "em_atencao" as StatusAnual },
  { rotulo: "75% a 89%", min: 75, max: 90, sem: "parcialmente_conforme" as StatusAnual, com: "em_atencao" as StatusAnual },
  { rotulo: "45% a 74%", min: 45, max: 75, sem: "em_atencao" as StatusAnual, com: "em_atencao" as StatusAnual },
  { rotulo: "< 45%", min: null as number | null, max: 45, sem: "nao_conforme" as StatusAnual, com: "nao_conforme" as StatusAnual },
] as const;

export const MEDIDAS_CICLO_ANUAL = [
  { consecutivo: 1, codigo: "advertencia", rotulo: "Advertência" },
  { consecutivo: 2, codigo: "suspensao_10_dias", rotulo: "Suspensão de 10 dias úteis" },
  { consecutivo: 3, codigo: "suspensao_definitiva", rotulo: "Suspensão definitiva" },
] as const;

export function exigeMedidaAnual(status: StatusAnual): boolean {
  return status === "nao_conforme" || status === "em_atencao";
}

export function pontuacaoOperacional(numeradorCorban: number, totalOcorrencias: number): number | null {
  if (totalOcorrencias <= 0) return null;
  if (numeradorCorban < 0) throw new Error("numerador Corban não pode ser negativo");
  const p = 100 * (1 - numeradorCorban / totalOcorrencias);
  return Math.round(p * 100) / 100;
}

export function pontuacaoGeral(componentes: (number | null | undefined)[]): number | null {
  const vals = componentes.filter((v): v is number => v != null && Number.isFinite(v));
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

function faixaDe(pontuacao: number) {
  if (pontuacao >= 90) return FAIXAS_ANUAL[0];
  if (pontuacao >= 75) return FAIXAS_ANUAL[1];
  if (pontuacao >= 45) return FAIXAS_ANUAL[2];
  return FAIXAS_ANUAL[3];
}

export function classificarAnual(args: {
  pontuacaoGeral: number | null;
  desvioCondutaGrave?: boolean;
}): ResultadoAnual {
  const { pontuacaoGeral: p, desvioCondutaGrave = false } = args;
  if (p == null || Number.isNaN(p)) {
    return {
      status: "nao_aplicavel",
      aplicavel: false,
      pontuacao: null,
      motivo: "sem pontuação de conformidade no ano — não inventamos zero",
    };
  }
  const faixa = faixaDe(p);
  const status = desvioCondutaGrave ? faixa.com : faixa.sem;
  const lado = desvioCondutaGrave ? "com desvio de conduta grave" : "sem desvio de conduta grave";
  return {
    status,
    aplicavel: true,
    pontuacao: p,
    motivo: `pontuação ${p.toFixed(2)}% na faixa ${faixa.rotulo} (${lado})`,
  };
}

export function medidaSugeridaAnual(
  statusAtual: StatusAnual,
  historicoAnterior: StatusAnual[],
): { consecutivo: number; codigo: string; rotulo: string } | null {
  if (!exigeMedidaAnual(statusAtual)) return null;
  let n = 1;
  for (let i = historicoAnterior.length - 1; i >= 0; i--) {
    if (exigeMedidaAnual(historicoAnterior[i])) n += 1;
    else break;
  }
  if (n >= 3) return { ...MEDIDAS_CICLO_ANUAL[2] };
  if (n === 2) return { ...MEDIDAS_CICLO_ANUAL[1] };
  return { ...MEDIDAS_CICLO_ANUAL[0] };
}

export function anosDisponiveis(meses: string[]): number[] {
  const set = new Set<number>();
  for (const m of meses) {
    const t = String(m || "").slice(0, 4);
    const n = Number(t);
    if (n >= 2000 && n <= 2100) set.add(n);
  }
  return [...set].sort((a, b) => b - a);
}
