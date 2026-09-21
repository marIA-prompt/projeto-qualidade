import Link from "next/link";
import { GraficoBarras } from "@/components/Charts";
import { Chip, Kpis, Tabela } from "@/components/ui";
import { contextoAgentes } from "@/lib/agentes/contexto";
import { queryPainel } from "@/lib/agentes/filtros";
import { fmtCpfCompleto, fmtIndice, mesRotulo } from "@/lib/agentes/format";

export default async function PaginaAgente({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cpf?: string }>;
}) {
  const { mes, cpf } = await searchParams;
  const ctx = await contextoAgentes(mes, cpf);
  if (!ctx.cpf) {
    return (
      <p className="text-sm text-[var(--senff-navy-text)]">
        Selecione um agente no filtro (CPF) para ver o desempenho individual.
      </p>
    );
  }
  const r = ctx.df[0];
  if (!r) {
    return <p>Nenhum dado deste agente neste mês.</p>;
  }
  const staff = ctx.role === "staff";
  const cpfExibido = staff ? fmtCpfCompleto(r.cpf_agente) : r.cpf_agente_mascarado;
  const mcb = ctx.mcb[0];
  const hist = ctx.snap.classificacoes
    .filter((c) => c.cpf_agente === ctx.cpf)
    .sort((a, b) => a.mes_referencia.localeCompare(b.mes_referencia));
  const barras = hist.map((h) => ({
    nome: mesRotulo(h.mes_referencia),
    Reclamações: h.qtd_reclamacoes_total,
    "Ações judiciais": h.qtd_acoes_judiciais_total,
  }));
  const q = queryPainel({ mes: ctx.mes, cpf: ctx.cpf });

  return (
    <section className="space-y-4">
      <div className="rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--senff-grey)]">
          Agente de crédito
        </p>
        <h2 className="text-xl font-semibold">{r.nome_agente || "—"}</h2>
        <p className="text-sm text-[var(--senff-navy-text)]">
          CPF {cpfExibido} · vínculo {r.nome_correspondente || "—"}
          {r.cnpj_correspondente ? ` (${r.cnpj_correspondente})` : ""}
        </p>
        <div className="mt-2">
          <Chip status={r.status} />
        </div>
      </div>
      <Kpis
        cards={[
          { label: "Reclamações", value: String(r.qtd_reclamacoes_total), hint: `${r.qtd_reclamacoes_procedentes_corban} proc. Corban`, tone: "acqua" },
          { label: "Ações judiciais", value: String(r.qtd_acoes_judiciais_total), hint: `${r.qtd_acoes_judiciais_procedentes_corban} proc. Corban`, tone: "navy" },
          { label: "Numerador", value: String(r.numerador), hint: `índice ${fmtIndice(r.indice)}`, tone: "sky" },
          { label: "Pontos MCB", value: String(mcb?.pontos_vigentes ?? 0), hint: mcb?.suspensao ? "há suspensão" : "sem suspensão", tone: "warn" },
        ]}
      />
      <p className="rounded-[var(--radius-box)] bg-white p-3 text-sm text-[var(--senff-navy-text)]">
        {r.motivo}
      </p>
      <h3 className="font-semibold">Evolução das ocorrências</h3>
      {barras.length ? (
        <GraficoBarras
          data={barras}
          series={[
            { key: "Reclamações", color: "#05aaca" },
            { key: "Ações judiciais", color: "#112369" },
          ]}
        />
      ) : (
        <p className="text-sm">Sem série mensal.</p>
      )}
      <h3 className="font-semibold">Ocorrências do mês (sem CPF de cliente)</h3>
      <Tabela
        colunas={[
          { chave: "tipo", titulo: "Tipo" },
          { chave: "canal", titulo: "Canal" },
          { chave: "parecer", titulo: "Parecer" },
          { chave: "resp", titulo: "Responsável" },
          { chave: "contrato", titulo: "Contrato" },
        ]}
        linhas={ctx.ocorrencias
          .filter((o) => !o.duplicada_unitariedade)
          .map((o) => ({
            tipo: o.tipo_ocorrencia === "1" ? "Ação judicial" : "Reclamação",
            canal: o.canal_origem || "—",
            parecer: o.parecer_detalhado || o.parecer || "—",
            resp: o.responsavel,
            contrato: o.numero_contrato || "—",
          }))}
      />
      <div className="flex flex-wrap gap-2">
        <Link className="btn-primary inline-block" href={`/agentes/evolucao${q}`}>
          Evolução
        </Link>
        <Link className="btn-primary inline-block" href={`/agentes/monitoramento-anual${q}`}>
          Monitoramento anual
        </Link>
        <Link className="btn-primary inline-block" href={`/agentes/auditorias${q}`}>
          Auditorias
        </Link>
        <Link className="btn-primary inline-block" href={`/agentes/relatorio${q}`}>
          Abrir relatório HTML
        </Link>
      </div>
    </section>
  );
}
