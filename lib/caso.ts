import type { Alerta } from "./alertas";
import type { Classificacao, ResumoAuditoria } from "./types";

export function rotuloMes(mes: string): string {
  return String(mes || "").slice(0, 7);
}

export function textoIndice(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(4)}%`;
}

export function textoStatusQuadro5(status: string): string {
  if (status === "nao_conforme") return "Não conforme no Quadro 5 (índice ≥ 0,03%).";
  if (status === "nao_aplicavel") {
    return "Não aplicável neste mês: sem carteira produzida, o índice do Quadro 5 não é calculado.";
  }
  if (status === "conforme") return "Conforme no Quadro 5 (índice abaixo de 0,03%).";
  return status;
}

export function textoDescritivo(c: Classificacao): string {
  const partes = [
    `${c.correspondente} (${c.cnpj}) no mês ${rotuloMes(c.mes_referencia)}.`,
    `${c.qtd_reclamacoes} reclamação(ões) (${c.qtd_reclamacoes_corban} procedente Corban · ${c.qtd_reclamacoes_senff} procedente Senff) e ${c.qtd_acoes_judiciais} ação(ões) judicial(is) (${c.qtd_acoes_judiciais_corban} Corban · ${c.qtd_acoes_judiciais_senff} Senff).`,
  ];
  if (c.qtd_indefinidas > 0) {
    partes.push(
      `${c.qtd_indefinidas} ocorrência(s) em andamento, sem classificação final Corban/Senff.`,
    );
  }
  if (c.canal_mais_frequente) {
    partes.push(`Canal mais frequente: ${c.canal_mais_frequente}.`);
  }
  partes.push(`Numerador do Quadro 5: ${c.numerador}. ${textoStatusQuadro5(c.status)}`);
  if (c.carteira_denominador == null) {
    partes.push("Carteira produzida ainda não carregada para este mês.");
  } else {
    partes.push(`Carteira produzida: ${c.carteira_denominador}. Índice: ${textoIndice(c.indice)}.`);
  }
  return partes.join(" ");
}

export function historicoDoCorrespondente(
  hist: Classificacao[],
  correspondenteId: string,
): Classificacao[] {
  return hist
    .filter((h) => h.correspondente_id === correspondenteId)
    .sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia));
}

export function alertasDoCorrespondente(alertas: Alerta[], correspondenteId: string): Alerta[] {
  return alertas.filter((a) => a.correspondente_id === correspondenteId);
}

export function auditoriasDoCorrespondente(
  resumo: ResumoAuditoria[],
  correspondenteId: string,
): ResumoAuditoria[] {
  return resumo.filter((r) => r.correspondente_id === correspondenteId);
}
