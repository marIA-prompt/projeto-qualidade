import Link from "next/link";
import { Chip, Kpis, Tabela } from "@/components/ui";
import { carregarAuditoriasAgente } from "@/lib/agentes/auditorias";
import { contextoAgentes } from "@/lib/agentes/contexto";
import { queryPainel } from "@/lib/agentes/filtros";
import { fmtIndice } from "@/lib/agentes/format";
import { formatarPontuacao, PILARES } from "@/lib/pilares";

export default async function ConsultaAgentePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cpf?: string }>;
}) {
  const { mes, cpf } = await searchParams;
  const ctx = await contextoAgentes(mes, cpf);

  if (ctx.role === "staff" && !ctx.cpf) {
    return (
      <p className="text-sm text-[var(--senff-navy-text)]">
        Art. 12 §7º — o agente consulta o próprio desempenho. Staff: escolha um
        CPF no filtro para pré-visualizar a tela que o digitador verá (CPF
        mascarado).
      </p>
    );
  }

  const r = ctx.df[0];
  const mcb = ctx.mcb[0];
  if (!r) {
    return <p>Não há fechamento deste mês para o seu CPF.</p>;
  }
  const auditorias = carregarAuditoriasAgente().filter((a) => a.cpf_agente === r.cpf_agente);
  const fraude = ctx.fraude[0];
  const kpis = [
    { label: "Índice do mês", value: fmtIndice(r.indice), hint: "teto 0,75%", tone: "acqua" },
    { label: "Numerador", value: String(r.numerador), tone: "navy" },
    { label: "Pontos MCB", value: String(mcb?.pontos_vigentes ?? 0), hint: "5 por NC · 20/12 meses", tone: "sky" },
    ...(fraude
      ? [{ label: "Arquivo 104", value: fraude.risco || "registro", hint: "trilho separado do índice", tone: "warn" }]
      : []),
  ];

  return (
    <section className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--senff-grey)]">
        Consulta individual · art. 12 §7º
      </p>
      <h2 className="text-xl font-semibold">{r.nome_agente || "Agente de crédito"}</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">CPF {r.cpf_agente_mascarado}</p>
      <Chip status={r.status} />
      <Kpis cards={kpis} />
      <p className="rounded-[var(--radius-box)] bg-white p-3 text-sm">{r.motivo}</p>
      <p className="text-sm text-[var(--senff-navy-text)]">{mcb?.motivo}</p>
      {auditorias.length ? (
        <>
          <h3 className="font-semibold">Auditorias no dossiê</h3>
          <p className="text-sm text-[var(--senff-navy-text)]">
            Registro operacional. Não altera o índice do mês nem os pontos MCB.
          </p>
          <Tabela
            colunas={[
              { chave: "Tipo", titulo: "Tipo" },
              { chave: "Data", titulo: "Data" },
              { chave: "Pilar", titulo: "Pilar" },
              { chave: "Pontuação", titulo: "Pontuação" },
            ]}
            linhas={auditorias.map((a) => ({
              Tipo: a.tipo === "interna" ? "Auditoria interna" : "Auditoria externa",
              Data: a.data_avaliacao,
              Pilar: PILARES[a.pilar] || a.pilar,
              Pontuação: formatarPontuacao(a.pontuacao),
            }))}
          />
        </>
      ) : null}
      <Link className="btn-primary inline-block" href={`/agentes/relatorio${queryPainel({ mes: ctx.mes, cpf: r.cpf_agente })}`}>
        Ver relatório
      </Link>
    </section>
  );
}
