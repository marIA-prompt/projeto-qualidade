export type Perfil = {
  role: "staff" | "correspondente";
  correspondente_id: string | null;
};

export type Classificacao = {
  id: string;
  correspondente_id: string;
  correspondente: string;
  cnpj: string;
  mes_referencia: string;
  qtd_reclamacoes: number;
  qtd_reclamacoes_corban: number;
  qtd_reclamacoes_senff: number;
  qtd_acoes_judiciais: number;
  qtd_acoes_judiciais_corban: number;
  qtd_acoes_judiciais_senff: number;
  qtd_indefinidas: number;
  canal_mais_frequente: string | null;
  numerador: number;
  carteira_denominador: number | null;
  indice: number | null;
  status: string;
  aplicavel: boolean;
};

export type ResumoAuditoria = {
  correspondente_id: string;
  correspondente: string;
  cnpj: string;
  tipo: string;
  data: string | null;
  pilares: number;
  media: number | null;
};

export type Indefinido = {
  tabela: "reclamacoes" | "acoes_judiciais";
  id: string;
  correspondente_id: string | null;
  correspondente: string;
  protocolo: string;
  ano_mes: string;
  encerrado_em: string | null;
  canal: string;
  parecer: string | null;
  fonte: string;
};
