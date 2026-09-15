/** Motor Quadro 5 (art. 9º) — port do Python `motor_classificacao`. Funções puras. */

export const LIMITE_INDICE_QUADRO5 = 0.0003;
export const CORTE_OPERACOES = 3000;
export const CORTE_RECLAMACOES_MES = 3;

export type StatusMensal = "conforme" | "nao_conforme" | "nao_aplicavel";

export type ResultadoMensal = {
  status: StatusMensal;
  aplicavel: boolean;
  numerador: number;
  denominador: number | null;
  indice: number | null;
  motivo: string;
  pendentes_indefinido: number;
};

export function classificarMensal(args: {
  reclamacoes_procedentes_corban: number;
  acoes_judiciais_procedentes_corban: number;
  total_reclamacoes_mes: number;
  carteira_produzida: number | null;
  pendentes_indefinido?: number;
  limite_indice?: number;
  corte_operacoes?: number;
  corte_reclamacoes_mes?: number;
}): ResultadoMensal {
  const {
    reclamacoes_procedentes_corban: rpc,
    acoes_judiciais_procedentes_corban: apc,
    total_reclamacoes_mes: total,
    carteira_produzida,
    pendentes_indefinido = 0,
    limite_indice = LIMITE_INDICE_QUADRO5,
    corte_operacoes = CORTE_OPERACOES,
    corte_reclamacoes_mes = CORTE_RECLAMACOES_MES,
  } = args;

  for (const [nome, valor] of [
    ["reclamacoes_procedentes_corban", rpc],
    ["acoes_judiciais_procedentes_corban", apc],
    ["total_reclamacoes_mes", total],
    ["pendentes_indefinido", pendentes_indefinido],
  ] as const) {
    if (valor < 0) throw new Error(`${nome} não pode ser negativo (recebido: ${valor})`);
  }

  const numerador = rpc + apc;

  if (carteira_produzida === null || carteira_produzida === undefined) {
    return {
      status: "nao_aplicavel",
      aplicavel: false,
      numerador,
      denominador: null,
      indice: null,
      motivo: "carteira produzida não carregada para o correspondente/mês",
      pendentes_indefinido,
    };
  }
  if (carteira_produzida <= 0) {
    return {
      status: "nao_aplicavel",
      aplicavel: false,
      numerador,
      denominador: carteira_produzida,
      indice: null,
      motivo: "carteira produzida zerada — denominador inválido para o índice",
      pendentes_indefinido,
    };
  }

  const atingiuCorte =
    carteira_produzida > corte_operacoes || total >= corte_reclamacoes_mes;
  if (!atingiuCorte) {
    return {
      status: "nao_aplicavel",
      aplicavel: false,
      numerador,
      denominador: carteira_produzida,
      indice: null,
      motivo: `corte de aplicabilidade não atingido (${carteira_produzida} operações <= ${corte_operacoes} e ${total} reclamações/mês < ${corte_reclamacoes_mes})`,
      pendentes_indefinido,
    };
  }

  const indice = numerador / carteira_produzida;
  const conforme = indice < limite_indice;
  return {
    status: conforme ? "conforme" : "nao_conforme",
    aplicavel: true,
    numerador,
    denominador: carteira_produzida,
    indice,
    motivo: conforme
      ? `índice ${indice.toFixed(6)} abaixo do limite regulatório ${limite_indice.toFixed(6)}`
      : `índice ${indice.toFixed(6)} igual ou acima do limite regulatório ${limite_indice.toFixed(6)}`,
    pendentes_indefinido,
  };
}

export function eProcedenteCorban(responsavel: string | null, parecer: string | null): boolean {
  if (responsavel !== "corban" || parecer == null) return false;
  return parecer.trim().toLowerCase().startsWith("procedente");
}

export function eProcedenteSenff(responsavel: string | null, parecer: string | null): boolean {
  if (responsavel !== "senff" || parecer == null) return false;
  return parecer.trim().toLowerCase().startsWith("procedente");
}
