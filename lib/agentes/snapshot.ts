import "server-only";
import { readFileSync } from "fs";
import { join } from "path";
import { mesChave } from "./format";

export type Ocorrencia = {
  id: string;
  tipo_ocorrencia: string;
  cnpj_correspondente: string | null;
  nome_correspondente: string | null;
  nome_agente: string | null;
  cpf_agente: string | null;
  cpf_agente_mascarado: string;
  canal_origem: string | null;
  tipo_reclamacao: string | null;
  parecer: string | null;
  parecer_detalhado: string | null;
  numero_contrato: string | null;
  encaminhou_fraudes: boolean;
  data_ocorrencia: string | null;
  data_encerramento: string | null;
  procedente: boolean;
  responsavel: string;
  mes_referencia: string;
  duplicada_unitariedade: boolean;
  excecao_cpf: boolean;
  sem_cpf_agente: boolean;
};

export type Classificacao = {
  mes_referencia: string;
  cpf_agente: string;
  cpf_agente_mascarado: string;
  nome_agente: string | null;
  cnpj_correspondente: string | null;
  cnpjs_vinculo: string | null;
  nome_correspondente: string | null;
  qtd_reclamacoes_total: number;
  qtd_reclamacoes_procedentes_corban: number;
  qtd_reclamacoes_procedentes_senff: number;
  qtd_reclamacoes_indefinidas: number;
  qtd_acoes_judiciais_total: number;
  qtd_acoes_judiciais_procedentes_corban: number;
  qtd_acoes_judiciais_procedentes_senff: number;
  qtd_acoes_judiciais_indefinidas: number;
  qtd_encaminhadas_fraudes: number;
  tipo_ocorrencia_mais_frequente: string;
  numerador_indice_quadro6: number;
  carteira_denominador: number | null;
  indice: number | null;
  aplicavel: boolean;
  status: string;
  motivo: string;
  numerador: number;
};

export type PontuacaoMcb = {
  cpf_agente: string;
  cpf_agente_mascarado: string;
  nome_agente: string | null;
  pontos_vigentes: number;
  suspensao: string | null;
  suspensao_inicio: string | null;
  suspensao_fim: string | null;
  zerou_em: string | null;
  motivo: string;
  eventos: { mes: string; pontos: number; vigente_ate: string }[];
};

export type Fraude104 = {
  cpf_agente: string;
  cpf_agente_mascarado: string;
  participantes_distintos: number;
  risco: string | null;
  acao: string | null;
  motivo: string;
};

export type Snapshot = {
  produto: string;
  observacao_carteira: string;
  ocorrencias: Ocorrencia[];
  classificacoes: Classificacao[];
  pontuacoes_mcb: PontuacaoMcb[];
  fraude_104: Fraude104[];
  excecoes_cpf: {
    protocolo: string;
    mes_referencia: string;
    cpf_detalhada: string | null;
    cpf_digitador: string | null;
    detalhe: string;
  }[];
};

function vazio(): Snapshot {
  return {
    produto: "Plano de Qualidade de Agentes de Crédito",
    observacao_carteira: "Snapshot ainda não gerado. Rode scripts/gerar_snapshot_agentes.py.",
    ocorrencias: [],
    classificacoes: [],
    pontuacoes_mcb: [],
    fraude_104: [],
    excecoes_cpf: [],
  };
}

let cache: Snapshot | null = null;

export function carregarSnapshot(): Snapshot {
  if (cache) return cache;
  const caminho = join(process.cwd(), "dados", "preview", "snapshot.json");
  try {
    cache = JSON.parse(readFileSync(caminho, "utf8")) as Snapshot;
  } catch {
    cache = vazio();
  }
  return cache;
}

export function mesesDoSnapshot(snap: Snapshot): string[] {
  const set = new Set<string>();
  for (const c of snap.classificacoes) set.add(mesChave(c.mes_referencia));
  return [...set].sort().reverse();
}

export function filtrarMes(linhas: Classificacao[], mes?: string | null): Classificacao[] {
  if (!mes) return linhas;
  const chave = mesChave(mes);
  return linhas.filter((l) => mesChave(l.mes_referencia) === chave);
}
