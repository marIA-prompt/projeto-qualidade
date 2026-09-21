import { SeletorAno } from "@/components/agentes/SeletorAno";
import { Chip, Kpis, Tabela } from "@/components/ui";
import { anosDisponiveis, consolidarAnoAgente } from "@/lib/agentes/anualAgente";
import { contextoAgentes } from "@/lib/agentes/contexto";

export default async function MonitoramentoAnualAgentesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cpf?: string; ano?: string }>;
}) {
  const { mes, cpf, ano: anoParam } = await searchParams;
  const ctx = await contextoAgentes(mes, cpf);
  const anos = anosDisponiveis(ctx.meses);
  const ano = Number(anoParam) || anos[0] || new Date().getFullYear();
  const linhas = consolidarAnoAgente(ctx.snap.classificacoes, ctx.snap.pontuacoes_mcb, ctx.snap.fraude_104, ano, ctx.cpf);
  const rec = linhas.reduce((s, r) => s + r.qtd_reclamacoes, 0);
  const nc = linhas.reduce((s, r) => s + r.meses_nao_conforme, 0);
  const mcb = linhas.filter((r) => r.pontos_mcb > 0).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold">Monitoramento anual</h2>
        <SeletorAno ano={ano} anos={anos} />
      </div>
      <p className="rounded-[var(--radius-box)] border border-[#E7C878] bg-[#FBF3DF] p-3 text-sm text-[#8A6410]">
        O Anexo I não define Quadro 3 para o agente. Esta tela consolida o{" "}
        <strong>Quadro 6 mensal</strong> e a pontuação <strong>MCB</strong> no ano civil. Não copia
        advertência, suspensão de 10 dias nem as faixas 90/75/45% do correspondente.
      </p>
      <Kpis
        cards={[
          { label: "Agentes no ano", value: String(linhas.length), tone: "acqua" },
          { label: "Reclamações no ano", value: String(rec), tone: "navy" },
          { label: "Meses NC (soma)", value: String(nc), hint: "cada NC = 5 pontos MCB", tone: "sky" },
          { label: "Com pontos MCB", value: String(mcb), tone: "warn" },
        ]}
      />
      <Tabela
        colunas={[
          { chave: "nome", titulo: "Agente" },
          { chave: "cpf", titulo: "CPF" },
          { chave: "vinculo", titulo: "Vínculo" },
          { chave: "meses", titulo: "Meses" },
          { chave: "rec", titulo: "Reclamações" },
          { chave: "aj", titulo: "Ações" },
          { chave: "num", titulo: "Numerador" },
          { chave: "cf", titulo: "Conforme" },
          { chave: "ncm", titulo: "NC" },
          { chave: "na", titulo: "N/A" },
          { chave: "pts", titulo: "Pontos MCB" },
          { chave: "susp", titulo: "Suspensão" },
        ]}
        linhas={linhas.map((r) => ({
          nome: r.nome_agente || r.cpf_agente_mascarado,
          cpf: r.cpf_agente_mascarado,
          vinculo: r.nome_correspondente || "—",
          meses: r.meses,
          rec: r.qtd_reclamacoes,
          aj: r.qtd_acoes,
          num: r.numerador,
          cf: r.meses_conforme,
          ncm: r.meses_nao_conforme,
          na: r.meses_nao_aplicavel,
          pts: r.pontos_mcb,
          susp: r.suspensao ? <Chip status={r.suspensao} /> : "—",
        }))}
      />
    </section>
  );
}
