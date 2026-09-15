import { GraficoBarras, GraficoLinha } from "@/components/Charts";
import { Chip } from "@/components/ui";
import { contextoPainel } from "@/lib/contexto";
import { barrasCanal, serieRede, topOcorrencias } from "@/lib/filtros";
import { fmtIndice } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const SERIES_OCORRENCIAS = [
  { key: "Reclamações", color: "#05aaca" },
  { key: "Ações judiciais", color: "#112369" },
  { key: "Numerador", color: "#4b90e2" },
];
const SERIES_CANAL = [{ key: "Reclamações", color: "#05aaca" }];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; corban?: string }>;
}) {
  const { mes, corban: corbanParam } = await searchParams;
  const { hist, mes: mesAtual, corban, correspondentes } = await contextoPainel(mes, corbanParam);
  if (!hist.length) {
    return (
      <p>
        {corban
          ? "Nenhum dado deste correspondente nos meses processados."
          : "Nenhum mês processado ainda."}
      </p>
    );
  }
  const sb = await createClient();
  const { data: recs } = await sb
    .from("reclamacoes")
    .select("canal_origem, mes_referencia, correspondente_id");

  const escolhido = correspondentes.find((c) => c.id === corban);
  const serie = serieRede(hist);
  const temIndice = serie.some((s) => s["Índice (%)"] != null);
  const canais = barrasCanal(recs || [], { mes: mesAtual, corban });
  const atual = hist.filter((h) => h.mes_referencia === mesAtual);
  const barrasCorr = topOcorrencias(atual);
  const linhaAtual = atual[0];

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Evolução ao longo dos meses</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        {escolhido
          ? `Visão de ${escolhido.nome}. A série e os canais são só deste correspondente.`
          : "Visão de todos os correspondentes. Use o filtro Correspondente ao lado do mês para ler um parceiro por vez."}{" "}
        Reclamações também aparecem quebradas por canal (Banco Central / Bacen, Procon, Ouvidoria,
        etc.).
      </p>
      {escolhido && linhaAtual ? (
        <p className="text-sm">
          Mês {mesAtual.slice(0, 7)}: {linhaAtual.qtd_reclamacoes} reclamações ·{" "}
          {linhaAtual.qtd_acoes_judiciais} ações · índice {fmtIndice(linhaAtual.indice)} ·{" "}
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
              <h3 className="mb-2 font-semibold">Índice Quadro 5 ao longo dos meses</h3>
              {temIndice ? (
                <GraficoLinha data={serie} series={[{ key: "Índice (%)", color: "#9b1c3a" }]} />
              ) : (
                <p className="rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-4 text-sm">
                  Sem denominador de carteira neste correspondente — o índice não é calculado.
                </p>
              )}
            </>
          ) : (
            <>
              <h3 className="mb-2 font-semibold">Correspondentes não conformes por mês</h3>
              <GraficoLinha data={serie} series={[{ key: "Não conformes", color: "#9b1c3a" }]} />
            </>
          )}
        </div>
      </div>
      <h3 className="font-semibold">
        {escolhido ? "Reclamações do mês por canal" : "Reclamações do mês por canal"}
      </h3>
      {canais.length ? (
        <GraficoBarras data={canais} series={SERIES_CANAL} />
      ) : (
        <p className="text-sm">Nenhuma reclamação com canal neste mês.</p>
      )}
      {!escolhido ? (
        <>
          <h3 className="font-semibold">Ocorrências do mês — top 10 correspondentes</h3>
          <p className="text-sm text-[var(--senff-navy-text)]">
            O gráfico da rede inteira fica ilegível. Aqui vão os 10 com mais reclamações; para o
            restante, filtre um correspondente.
          </p>
          <GraficoBarras
            data={barrasCorr}
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
