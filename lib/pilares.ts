export const PILARES: Record<string, string> = {
  lgpd: "Adequação à LGPD",
  treinamento: "Aprendizado e Conhecimento",
  governanca: "Políticas de Governança",
  relacionamento_cliente: "Relacionamento com Cliente",
  tecnologia_informacao: "Tecnologia da Informação",
};

export const SUBCRITERIOS: Record<string, Record<string, string>> = {
  tecnologia_informacao: {
    seguranca_equipamentos: "Segurança dos equipamentos",
    controle_acesso: "Controle de acesso",
    armazenamento_documentos: "Armazenamento de documentos",
    rastreabilidade: "Rastreabilidade",
    prevencao_fraudes: "Prevenção a fraudes",
  },
  lgpd: {
    origem_leads: "Origem dos leads",
    compartilhamento_dados: "Compartilhamento de dados",
    tratamento_dados: "Tratamento de dados",
    consentimento: "Consentimento",
    armazenamento: "Armazenamento",
  },
  relacionamento_cliente: {
    clareza_informacoes: "Clareza das informações",
    linguagem: "Linguagem utilizada",
    qualidade_atendimento: "Qualidade do atendimento",
    respeito_consumidor: "Respeito ao consumidor",
    oferta_responsavel: "Oferta responsável",
  },
  governanca: {
    politicas_internas: "Políticas internas",
    controles: "Controles",
    segregacao_funcoes: "Segregação de funções",
    certificacoes: "Certificações",
    gestao_documental: "Gestão documental",
  },
  treinamento: {
    treinamentos_obrigatorios: "Treinamentos obrigatórios",
    reciclagens: "Reciclagens",
    certificacoes: "Certificações",
  },
};

export const NOTAS: Record<string, number> = { ok: 100, parcial: 50, nao_ok: 0 };

export const ROTULOS_NOTA: Record<string, string> = {
  ok: "Ok",
  parcial: "Parcial",
  nao_ok: "Não ok",
  nao_avaliado: "Não avaliado",
};

export const TIPOS_AUDITORIA = {
  externa: { tabela: "auditorias_externas", rotulo: "Auditoria externa" },
  interna: { tabela: "auditorias_internas", rotulo: "Auditoria interna" },
} as const;

export function pontuacaoPilar(subcriterios: Record<string, string>): number | null {
  const notas = Object.values(subcriterios)
    .filter((v) => v in NOTAS)
    .map((v) => NOTAS[v]);
  if (!notas.length) return null;
  return Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100;
}

/** Percentual do relatório oficial (0–100). Vazio = sem nota. Não calcula média. */
export function parsePontuacaoManual(
  bruto: unknown,
): { ok: true; valor: number | null } | { ok: false; erro: string } {
  const raw = String(bruto ?? "")
    .trim()
    .replace("%", "")
    .replace(",", ".");
  if (!raw) return { ok: true, valor: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return { ok: false, erro: "Informe a pontuação da auditoria (0 a 100)." };
  }
  if (n < 0 || n > 100) {
    return { ok: false, erro: "A pontuação da auditoria deve estar entre 0 e 100." };
  }
  return { ok: true, valor: Math.round(n * 100) / 100 };
}

export function formatarPontuacao(valor: number | string | null | undefined): string {
  if (valor == null || valor === "") return "—";
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  if (!Number.isFinite(n)) return "—";
  return `${n}%`;
}
