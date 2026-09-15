import { GraficoBarras, GraficoLinha } from "@/components/Charts";
import { contextoPainel } from "@/lib/contexto";
import { mesIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const { hist } = await contextoPainel(mes);
  if (!hist.length) return <p>Nenhum mês processado ainda.</p>;
  const sb = await createClient();
  const { data: recs } = await sb.from("reclamacoes").select("canal_origem, mes_referencia");

  const porMes = new Map<string, { Reclamações: number; "Ações judiciais": number; Numerador: number; "Não conformes": number }>();
  for (const r of hist) {
    const k = r.mes_referencia.slice(0, 7);
    const cur = porMes.get(k) || { Reclamações: 0, "Ações judiciais": 0, Numerador: 0, "Não conformes": 0 };
    cur.Reclamações += r.qtd_reclamacoes;
    cur["Ações judiciais"] += r.qtd_acoes_judiciais;
    cur.Numerador += r.numerador;
    if (r.status === "nao_conforme") cur["Não conformes"] += 1;
    porMes.set(k, cur);
  }
  const serie = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mesKey, v]) => ({ mes: mesKey, ...v }));

  const mesAtual = mesIso(mes || hist[0].mes_referencia);
  const atual = hist.filter((h) => h.mes_referencia === mesAtual);
  const barras = [...atual]
    .sort((a, b) => b.qtd_reclamacoes - a.qtd_reclamacoes)
    .map((r) => ({
      nome: r.correspondente,
      Reclamações: r.qtd_reclamacoes,
      "Ações judiciais": r.qtd_acoes_judiciais,
    }));

  const porCanal = new Map<string, number>();
  for (const r of recs || []) {
    if (mesIso(r.mes_referencia) !== mesAtual) continue;
    const canal = (r.canal_origem || "Sem canal").trim() || "Sem canal";
    porCanal.set(canal, (porCanal.get(canal) || 0) + 1);
  }
  const canais = [...porCanal.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nome, n]) => ({ nome, Reclamações: n }));
  const seriesCanal = [{ key: "Reclamações", color: "#05aaca" }];

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Evolução ao longo dos meses</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        A série cresce a cada fechamento (ETL). Reclamações também aparecem quebradas por canal
        (Banco Central / Bacen, Procon, Ouvidoria, etc.).
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold">Reclamações, ações e numerador (rede)</h3>
          <GraficoLinha
            data={serie}
            series={[
              { key: "Reclamações", color: "#05aaca" },
              { key: "Ações judiciais", color: "#112369" },
              { key: "Numerador", color: "#4b90e2" },
            ]}
          />
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Correspondentes não conformes por mês</h3>
          <GraficoLinha
            data={serie}
            series={[{ key: "Não conformes", color: "#9b1c3a" }]}
          />
        </div>
      </div>
      <h3 className="font-semibold">Reclamações do mês por canal</h3>
      {canais.length ? (
        <GraficoBarras data={canais} series={seriesCanal} />
      ) : (
        <p className="text-sm">Nenhuma reclamação com canal neste mês.</p>
      )}
      <h3 className="font-semibold">Ocorrências do mês corrente por correspondente</h3>
      <GraficoBarras
        data={barras}
        series={[
          { key: "Reclamações", color: "#05aaca" },
          { key: "Ações judiciais", color: "#112369" },
        ]}
      />
    </section>
  );
}
