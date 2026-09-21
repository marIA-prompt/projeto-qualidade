import { GraficoBarras, GraficoLinha } from "@/components/Charts";
import { Chip } from "@/components/ui";
import { contextoAgentes } from "@/lib/agentes/contexto";
import { barrasCanal, serieMensal, topAgentesMes } from "@/lib/agentes/evolucao";
import { fmtIndice } from "@/lib/agentes/format";

const SERIES_OCORRENCIAS = [
  { key: "Reclamações", color: "#05aaca" },
  { key: "Ações judiciais", color: "#112369" },
  { key: "Numerador", color: "#4b90e2" },
];
const SERIES_CANAL = [{ key: "Reclamações", color: "#05aaca" }];

export default async function EvolucaoAgentesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cpf?: string }>;
}) {
  const { mes, cpf } = await searchParams;
  const ctx = await contextoAgentes(mes, cpf);
  const hist = ctx.cpf
    ? ctx.snap.classificacoes.filter((c) => c.cpf_agente === ctx.cpf)
    : ctx.snap.classificacoes;
  if (!hist.length) {
    return <p>{ctx.cpf ? "Nenhum dado deste agente nos meses processados." : "Nenhum mês processado ainda."}</p>;
  }
  const escolhido = ctx.agentes.find((a) => a.cpf === ctx.cpf);
  const serie = serieMensal(hist, ctx.cpf);
  const temIndice = Boolean(ctx.cpf) && serie.some((s) => s["Índice (%)"] != null);
  const canais = barrasCanal(ctx.snap.ocorrencias, { mes: ctx.mes, cpf: ctx.cpf });
  const linhaAtual = ctx.df[0];

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Evolução ao longo dos meses</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        {escolhido
          ? `Visão de ${escolhido.nome} (${escolhido.mascara}). A série e os canais são só deste CPF.`
          : "Visão de todos os agentes. Use o filtro Agente (CPF) ao lado do mês para ler um digitador por vez."}{" "}
        Quadro 6 — não copia o corte do Quadro 5.
      </p>
      {escolhido && linhaAtual ? (
        <p className="text-sm">
          Mês {ctx.mes}: {linhaAtual.qtd_reclamacoes_total} reclamações ·{" "}
          {linhaAtual.qtd_acoes_judiciais_total} ações · índice {fmtIndice(linhaAtual.indice)} ·{" "}
          <Chip status={linhaAtual.status} />
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold">
            {escolhido ? "Reclamações, ações e numerador" : "Reclamações, ações e numerador (rede)"}
          </h3>
          <GraficoLinha data={serie} series={SERIES_OCORRENCIAS} />
        </div>
        <div>
          {escolhido ? (
            <>
              <h3 className="mb-2 font-semibold">Índice Quadro 6 ao longo dos meses</h3>
              {temIndice ? (
                <GraficoLinha data={serie} series={[{ key: "Índice (%)", color: "#9b1c3a" }]} />
              ) : (
                <p className="rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-4 text-sm">
                  Sem denominador de carteira neste agente — o índice não é calculado.
                </p>
              )}
            </>
          ) : (
            <>
              <h3 className="mb-2 font-semibold">Agentes não conformes por mês</h3>
              <GraficoLinha data={serie} series={[{ key: "Não conformes", color: "#9b1c3a" }]} />
            </>
          )}
        </div>
      </div>
      <h3 className="font-semibold">Reclamações do mês por canal</h3>
      {canais.length ? (
        <GraficoBarras data={canais} series={SERIES_CANAL} />
      ) : (
        <p className="text-sm">Nenhuma reclamação com canal neste mês.</p>
      )}
      {!escolhido ? (
        <>
          <h3 className="font-semibold">Ocorrências do mês — top 10 agentes</h3>
          <p className="text-sm text-[var(--senff-navy-text)]">
            O gráfico da rede inteira fica ilegível. Aqui vão os 10 com mais reclamações; para o
            restante, filtre um CPF.
          </p>
          <GraficoBarras
            data={topAgentesMes(ctx.df)}
            series={[
              { key: "Reclamações", color: "#05aaca" },
              { key: "Ações judiciais", color: "#112369" },
            ]}
          />
        </>
      ) : null}
    </section>
  );
}
