import { TabelaQuadro6 } from "@/components/agentes/TabelaQuadro6";
import { Kpis } from "@/components/ui";
import { contextoAgentes } from "@/lib/agentes/contexto";

export default async function VisaoGeralAgentes({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cpf?: string }>;
}) {
  const { mes, cpf } = await searchParams;
  const ctx = await contextoAgentes(mes, cpf);
  const { df } = ctx;
  const rec = df.reduce((s, r) => s + r.qtd_reclamacoes_total, 0);
  const recC = df.reduce((s, r) => s + r.qtd_reclamacoes_procedentes_corban, 0);
  const aj = df.reduce((s, r) => s + r.qtd_acoes_judiciais_total, 0);
  const ajC = df.reduce((s, r) => s + r.qtd_acoes_judiciais_procedentes_corban, 0);
  const nc = df.filter((r) => r.status === "nao_conforme").length;
  const na = df.filter((r) => r.status === "nao_aplicavel").length;

  return (
    <>
      <p className="rounded-[var(--radius-box)] border border-[#E7C878] bg-[#FBF3DF] p-3 text-sm text-[#8A6410]">
        {ctx.snap.observacao_carteira} Corte do Quadro 6: mais de 50 operações{" "}
        <strong>e</strong> mais de 1 reclamação. Teto: ≤ 0,75% conforme, &gt; 0,75% não
        conforme.
      </p>
      <Kpis
        cards={[
          {
            label: "Agentes no mês",
            value: String(df.length),
            hint: `${na} não aplicável · ${nc} não conforme`,
            tone: "acqua",
          },
          {
            label: "Reclamações",
            value: String(rec),
            hint: `${recC} procedente-Corban (proxy do numerador)`,
            tone: "navy",
          },
          {
            label: "Ações judiciais",
            value: String(aj),
            hint: `${ajC} procedente-Corban`,
            tone: "sky",
          },
          {
            label: "Numerador Quadro 6",
            value: String(df.reduce((s, r) => s + r.numerador, 0)),
            hint: "indefinido fora do numerador",
            tone: "warn",
          },
        ]}
      />
      <TabelaQuadro6
        mes={ctx.mes}
        linhas={[...df]
          .sort(
            (a, b) =>
              b.qtd_reclamacoes_total - a.qtd_reclamacoes_total ||
              b.qtd_acoes_judiciais_total - a.qtd_acoes_judiciais_total,
          )
          .map((r) => ({
            cpf: r.cpf_agente,
            nome: r.nome_agente || r.cpf_agente_mascarado,
            mascara: r.cpf_agente_mascarado,
            corban: r.nome_correspondente || "—",
            rec: r.qtd_reclamacoes_total,
            aj: r.qtd_acoes_judiciais_total,
            num: r.numerador,
            cart: r.carteira_denominador ?? "—",
            idx: r.indice,
            status: r.status,
          }))}
      />
    </>
  );
}
