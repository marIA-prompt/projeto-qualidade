import { GraficoBarras } from "@/components/Charts";
import { Chip, Kpis, Tabela } from "@/components/ui";
import { contextoPainel } from "@/lib/contexto";
import { montarLinhasExport } from "@/lib/dados";
import { barrasCanal, topOcorrencias } from "@/lib/filtros";
import { csvFechamento } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";
import { fmtIndice } from "@/lib/format";

const SERIES_CANAL = [{ key: "Reclamações", color: "#05aaca" }];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; corban?: string }>;
}) {
  const { mes, corban: corbanParam } = await searchParams;
  const ctx = await contextoPainel(mes, corbanParam);
  const { df, corban } = ctx;
  if (!df.length) {
    return (
      <p>
        {corban
          ? "Nenhum dado deste correspondente neste mês."
          : "Nenhum mês processado ainda. Rode o ETL de reclamações."}
      </p>
    );
  }
  const sb = await createClient();
  const recSel = sb
    .from("reclamacoes")
    .select("correspondente_id, responsavel, parecer, canal_origem")
    .eq("mes_referencia", ctx.mes);
  const ajSel = sb
    .from("acoes_judiciais")
    .select("correspondente_id, responsavel, parecer")
    .eq("mes_referencia", ctx.mes);
  const [{ data: rec }, { data: aj }] = await Promise.all([recSel, ajSel]);
  const recMes = (rec || []).filter((r) => !corban || r.correspondente_id === corban);
  const ajMes = (aj || []).filter((r) => !corban || r.correspondente_id === corban);
  const exportDf = montarLinhasExport(df, recMes, ajMes);
  const csv = csvFechamento(exportDf);
  const andamento = df.reduce((s, r) => s + r.qtd_indefinidas, 0);
  const canais = barrasCanal(recMes, { mes: ctx.mes, corban });
  const barrasCorr = topOcorrencias(df, corban ? df.length : 10);

  return (
    <section className="space-y-4">
      <Kpis
        cards={[
          { label: "Correspondentes", value: String(df.length), tone: "acqua" },
          { label: "Não conformes", value: String(df.filter((r) => r.status === "nao_conforme").length), tone: "navy" },
          { label: "Não aplicáveis", value: String(df.filter((r) => r.status === "nao_aplicavel").length), tone: "sky" },
          { label: "Em andamento", value: String(andamento), tone: "warn" },
        ]}
      />
      {andamento > 0 ? (
        <p className="rounded-[var(--radius-box)] bg-[#fff6e8] p-3 text-sm">
          Há ocorrências sem classificação final Corban/Senff. Elas não entram no índice.
        </p>
      ) : null}
      <Tabela
        colunas={[
          { chave: "c", titulo: "Correspondente" },
          { chave: "cnpj", titulo: "CNPJ" },
          { chave: "rec", titulo: "Reclamações" },
          { chave: "rpc", titulo: "Proc.-Corban rec." },
          { chave: "aj", titulo: "Ações" },
          { chave: "apc", titulo: "Proc.-Corban ações" },
          { chave: "ind", titulo: "Indefinidas" },
          { chave: "num", titulo: "Numerador" },
          { chave: "cart", titulo: "Carteira" },
          { chave: "idx", titulo: "Índice" },
          { chave: "st", titulo: "Status" },
          { chave: "canal", titulo: "Canal" },
        ]}
        linhas={df.map((r) => ({
          c: r.correspondente,
          cnpj: r.cnpj,
          rec: r.qtd_reclamacoes,
          rpc: r.qtd_reclamacoes_corban,
          aj: r.qtd_acoes_judiciais,
          apc: r.qtd_acoes_judiciais_corban,
          ind: r.qtd_indefinidas,
          num: r.numerador,
          cart: r.carteira_denominador ?? "—",
          idx: fmtIndice(r.indice),
          st: <Chip status={r.status} />,
          canal: r.canal_mais_frequente || "—",
        }))}
      />
      <a
        className="btn-primary inline-block"
        href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
        download={`fechamento_correspondentes_${ctx.mes.slice(0, 7)}.csv`}
      >
        Baixar fechamento (.csv)
      </a>
      <p className="text-xs text-[var(--senff-grey)]">
        CSV no formato do analista, no que o schema V1 permite. Não inclui encaminhamentos a
        Fraudes nem tipo de reclamação.
      </p>
      <h3 className="font-semibold">Reclamações por canal</h3>
      {canais.length ? (
        <GraficoBarras data={canais} series={SERIES_CANAL} />
      ) : (
        <p className="text-sm">Nenhuma reclamação com canal neste mês.</p>
      )}
      <h3 className="font-semibold">
        {corban ? "Ocorrências do correspondente" : "Ocorrências por correspondente (top 10)"}
      </h3>
      <GraficoBarras
        data={barrasCorr}
        series={[
          { key: "Reclamações", color: "#05aaca" },
          { key: "Ações judiciais", color: "#112369" },
        ]}
      />
    </section>
  );
}
