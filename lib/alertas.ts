import { CORTE_RECLAMACOES_MES, LIMITE_INDICE_QUADRO5 } from "./motor";

export const LIMIAR_ALERTA_INTERNO = LIMITE_INDICE_QUADRO5 * 0.8;

export const CRITERIOS_SEVERIDADE = [
  {
    nivel: "Crítico",
    regra: "Não conforme no Quadro 5",
    metrica: "Índice ≥ 0,03% (teto FEBRABAN art. 9º)",
  },
  {
    nivel: "Atenção",
    regra: "Índice próximo do teto",
    metrica: "Índice ≥ 0,024% (80% do teto de 0,03%)",
  },
  {
    nivel: "Atenção",
    regra: "Volume de reclamações no mês",
    metrica: "≥ 3 reclamações (corte de aplicabilidade)",
  },
  {
    nivel: "Atenção",
    regra: "Relacionamento",
    metrica: "≥ 3 reclamações e canal mais frequente informado",
  },
  {
    nivel: "Informativo",
    regra: "Em andamento",
    metrica: "Ocorrência sem classificação final Corban/Senff (não entra no índice)",
  },
  {
    nivel: "Informativo",
    regra: "Auditoria",
    metrica: "Sem auditoria externa e/ou interna cadastrada",
  },
] as const;

export const SEV_CRITICO = "critico";
export const SEV_ATENCAO = "atencao";
export const SEV_INFO = "info";

export type Severidade = typeof SEV_CRITICO | typeof SEV_ATENCAO | typeof SEV_INFO;

export type Alerta = {
  correspondente_id: string;
  correspondente: string;
  mes_referencia: string;
  tipo: string;
  severidade: Severidade;
  mensagem: string;
};

export function avaliarCorrespondente(args: {
  correspondente_id: string;
  correspondente: string;
  mes_referencia: string;
  status: string;
  indice: number | null;
  qtd_reclamacoes: number;
  qtd_indefinidas: number;
  canal_mais_frequente: string | null;
  tem_auditoria_externa: boolean;
  tem_auditoria_interna: boolean;
  limiar_interno?: number;
  corte_reclamacoes?: number;
}): Alerta[] {
  const {
    correspondente_id,
    correspondente,
    mes_referencia,
    status,
    indice,
    qtd_reclamacoes,
    qtd_indefinidas,
    canal_mais_frequente,
    tem_auditoria_externa,
    tem_auditoria_interna,
    limiar_interno = LIMIAR_ALERTA_INTERNO,
    corte_reclamacoes = CORTE_RECLAMACOES_MES,
  } = args;
  const base = { correspondente_id, correspondente, mes_referencia };
  const alertas: Alerta[] = [];

  if (status === "nao_conforme") {
    alertas.push({
      ...base,
      tipo: "nao_conforme",
      severidade: SEV_CRITICO,
      mensagem: `${correspondente} ficou não conforme no Quadro 5 (índice ≥ ${(LIMITE_INDICE_QUADRO5 * 100).toFixed(2)}%).`,
    });
  } else if (indice != null && indice >= limiar_interno) {
    alertas.push({
      ...base,
      tipo: "indice_atencao",
      severidade: SEV_ATENCAO,
      mensagem: `${correspondente} atingiu ${(indice * 100).toFixed(4)}% do índice (limiar interno de ${(limiar_interno * 100).toFixed(4)}%, 80% do teto regulatório).`,
    });
  }

  if (qtd_reclamacoes >= corte_reclamacoes) {
    alertas.push({
      ...base,
      tipo: "volume_reclamacoes",
      severidade: SEV_ATENCAO,
      mensagem: `${correspondente} teve ${qtd_reclamacoes} reclamações no mês (corte de aplicabilidade ≥ ${corte_reclamacoes}).`,
    });
  }

  if (qtd_indefinidas > 0) {
    alertas.push({
      ...base,
      tipo: "indefinidas",
      severidade: SEV_INFO,
      mensagem: `${correspondente} tem ${qtd_indefinidas} ocorrência(s) sem atribuição Corban/Senff — não entram no índice até confirmação.`,
    });
  }

  if (!tem_auditoria_externa || !tem_auditoria_interna) {
    const faltando = [
      !tem_auditoria_externa ? "externa" : null,
      !tem_auditoria_interna ? "interna" : null,
    ].filter(Boolean);
    alertas.push({
      ...base,
      tipo: "auditoria_pendente",
      severidade: SEV_INFO,
      mensagem: `${correspondente} sem auditoria ${faltando.join(" e ")} registrada — indicadores 3 e 4 do art. 51.`,
    });
  }

  if (qtd_reclamacoes >= corte_reclamacoes && canal_mais_frequente) {
    alertas.push({
      ...base,
      tipo: "relacionamento",
      severidade: SEV_ATENCAO,
      mensagem: `${correspondente}: volume de reclamações concentrado no canal '${canal_mais_frequente}'. Priorizar conversa de relacionamento (clareza, atendimento, oferta responsável) antes de medida punitiva.`,
    });
  }

  return alertas;
}

export function acaoRelacionamento(alertas: Alerta[]): string {
  const tipos = new Set(alertas.map((a) => a.tipo));
  if (tipos.has("nao_conforme")) {
    return "Agendar reunião de acompanhamento com o correspondente. A Gestora de Qualidade decide se cabe medida; o sistema não aplica sanção automática. Preferir reorientação de conduta / notificação antes de suspensão.";
  }
  if (tipos.has("relacionamento") || tipos.has("volume_reclamacoes")) {
    return "Abrir conversa de relacionamento focada no canal com mais reclamações: clareza das informações, qualidade do atendimento e oferta responsável.";
  }
  if (tipos.has("indefinidas")) {
    return "Pedir ao correspondente a atribuição Corban/Senff das ocorrências indefinidas — sem isso o índice fica incompleto.";
  }
  if (tipos.has("auditoria_pendente")) {
    return "Combinar janela de auditoria interna/externa, começando pelo pilar Relacionamento com Cliente.";
  }
  return "Manter rotina de relacionamento: feedback do mês e alinhamento de qualidade.";
}
