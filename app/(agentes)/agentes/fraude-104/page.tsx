import { Chip, Kpis, Tabela } from "@/components/ui";
import { contextoAgentes } from "@/lib/agentes/contexto";
import { ROTULOS_ACAO_104 } from "@/lib/agentes/format";

const REGRAS_104 = [
  {
    n: "0",
    risco: "—",
    acao: "Sem registro neste trilho",
    detalhe: "Não inventa ocorrência. O agente pode ter reclamação no Navigate e mesmo assim não aparecer aqui.",
  },
  {
    n: "1 Participante",
    risco: "Baixo",
    acao: "Monitoramento 1",
    detalhe: "Monitorar as operações do CPF segundo as políticas internas da Senff.",
  },
  {
    n: "2 Participantes",
    risco: "Moderado",
    acao: "Monitoramento 2",
    detalhe: "Monitorar e aplicar ações complementares.",
  },
  {
    n: "3 ou mais",
    risco: "Alto",
    acao: "Suspensão definitiva",
    detalhe: "O Participante deixa de operar com aquele agente.",
  },
];

export default async function Fraude104Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cpf?: string }>;
}) {
  const { mes, cpf } = await searchParams;
  const ctx = await contextoAgentes(mes, cpf);
  const lista = ctx.fraude;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Golpe, fraude e falsidade — arquivo 104</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        Esta tela <strong>não</strong> lê o Navigate (reclamações/ações do Quadro 6). É o trilho
        dos arts. 13 e 14: só práticas <strong>comprovadas</strong> de golpe, fraude ou falsidade
        ideológica que geraram rec/AJ procedentes, informadas num arquivo específico da
        autorregulação chamado <strong>104</strong>. A chave continua sendo o <strong>CPF do
        agente</strong>.
      </p>
      <p className="text-sm text-[var(--senff-navy-text)]">
        “Participante” aqui é a instituição financeira que registrou o fato (outro banco da
        autorregulação), não o digitador. O motor conta Participantes <strong>distintos</strong>{" "}
        com registro comprovado naquele CPF e aplica a faixa abaixo. Não decide se a prática é
        comprovada — isso já vem filtrado no arquivo.
      </p>
      <Tabela
        colunas={[
          { chave: "n", titulo: "Participantes distintos" },
          { chave: "risco", titulo: "Risco" },
          { chave: "acao", titulo: "Ação" },
          { chave: "detalhe", titulo: "O que a Senff faz" },
        ]}
        linhas={REGRAS_104}
      />
      <Kpis
        cards={[
          { label: "CPFs no arquivo 104", value: String(lista.length), tone: "acqua" },
          { label: "Monitoramento 1", value: String(lista.filter((f) => f.acao === "monitoramento_1").length), tone: "navy" },
          { label: "Monitoramento 2", value: String(lista.filter((f) => f.acao === "monitoramento_2").length), tone: "sky" },
          { label: "Suspensão definitiva", value: String(lista.filter((f) => f.acao === "suspensao_definitiva").length), tone: "warn" },
        ]}
      />
      {lista.length === 0 ? (
        <p className="rounded-[var(--radius-box)] border border-[#E7C878] bg-[#FBF3DF] p-3 text-sm text-[#8A6410]">
          Nenhum CPF carregado: a Senff ainda não enviou/espelhou o arquivo 104 neste produto.
          Sem esse arquivo o motor não inventa ocorrência — os KPIs ficam em zero de propósito.
        </p>
      ) : (
        <Tabela
          colunas={[
            { chave: "cpf", titulo: "CPF" },
            { chave: "n", titulo: "Participantes" },
            { chave: "risco", titulo: "Risco" },
            { chave: "acao", titulo: "Ação" },
            { chave: "motivo", titulo: "Motivo" },
          ]}
          linhas={lista.map((f) => ({
            cpf: f.cpf_agente_mascarado,
            n: f.participantes_distintos,
            risco: f.risco ? <Chip status={f.risco} /> : "—",
            acao: f.acao ? ROTULOS_ACAO_104[f.acao] || f.acao : "—",
            motivo: f.motivo,
          }))}
        />
      )}
    </section>
  );
}
