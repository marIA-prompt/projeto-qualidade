"use client";

import { useMemo, useState } from "react";
import { GraficoLinha } from "@/components/Charts";
import { Chip, Tabela } from "@/components/ui";
import { acaoRelacionamento, type Alerta } from "@/lib/alertas";
import { fmtIndice } from "@/lib/format";
import type { Classificacao, ResumoAuditoria } from "@/lib/types";

export function PainelCorrespondente({
  df,
  hist,
  resumo,
  alertas,
  filtroGlobal,
}: {
  df: Classificacao[];
  hist: Classificacao[];
  resumo: ResumoAuditoria[];
  alertas: Alerta[];
  filtroGlobal?: boolean;
}) {
  const opcoes = useMemo(
    () => [...df].sort((a, b) => b.qtd_reclamacoes - a.qtd_reclamacoes),
    [df],
  );
  const [id, setId] = useState(opcoes[0]?.correspondente_id || "");
  const escolhido = opcoes.find((r) => r.correspondente_id === id) || opcoes[0];
  if (!escolhido) return <p>Nenhum correspondente no mês.</p>;
  const meus = alertas.filter((a) => a.correspondente_id === escolhido.correspondente_id);
  const serie = hist
    .filter((h) => h.correspondente_id === escolhido.correspondente_id)
    .sort((a, b) => a.mes_referencia.localeCompare(b.mes_referencia))
    .map((h) => ({
      mes: h.mes_referencia.slice(0, 7),
      Reclamações: h.qtd_reclamacoes,
      "Ações judiciais": h.qtd_acoes_judiciais,
      "Numerador Quadro 5": h.numerador,
    }));
  const aud = resumo.filter((r) => r.correspondente_id === escolhido.correspondente_id);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Painel visual por correspondente</h2>
      {filtroGlobal ? (
        <p className="text-sm text-[var(--senff-navy-text)]">
          Correspondente definido no filtro ao lado do mês: {escolhido.correspondente}.
        </p>
      ) : (
        <select
          className="max-w-lg rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
          value={escolhido.correspondente_id}
          onChange={(e) => setId(e.target.value)}
        >
          {opcoes.map((r) => (
            <option key={r.correspondente_id} value={r.correspondente_id}>
              {r.correspondente} ({r.cnpj})
            </option>
          ))}
        </select>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Reclamações" value={String(escolhido.qtd_reclamacoes)} />
        <Kpi label="Ações judiciais" value={String(escolhido.qtd_acoes_judiciais)} />
        <Kpi label="Índice" value={fmtIndice(escolhido.indice)} />
        <div>
          <div className="text-xs uppercase text-[var(--senff-grey)]">Status</div>
          <Chip status={escolhido.status} />
        </div>
      </div>
      <Tabela
        colunas={[
          { chave: "c", titulo: "Campo" },
          { chave: "v", titulo: "Valor" },
        ]}
        linhas={[
          { c: "Proc.-Corban (reclamações)", v: escolhido.qtd_reclamacoes_corban },
          { c: "Proc.-Senff (reclamações)", v: escolhido.qtd_reclamacoes_senff },
          { c: "Proc.-Corban (ações)", v: escolhido.qtd_acoes_judiciais_corban },
          { c: "Proc.-Senff (ações)", v: escolhido.qtd_acoes_judiciais_senff },
          { c: "Em andamento", v: escolhido.qtd_indefinidas },
          { c: "Canal mais frequente", v: escolhido.canal_mais_frequente || "—" },
          { c: "Carteira produzida", v: escolhido.carteira_denominador ?? "não carregada" },
        ]}
      />
      <h3 className="font-semibold">Auditorias (indicadores 3 e 4)</h3>
      <Tabela
        colunas={[
          { chave: "tipo", titulo: "Tipo" },
          { chave: "data", titulo: "Data" },
          { chave: "pilares", titulo: "Pilares" },
          { chave: "media", titulo: "Média" },
        ]}
        linhas={aud.map((a) => ({
          tipo: a.tipo,
          data: a.data || "—",
          pilares: a.pilares,
          media: a.media ?? "—",
        }))}
      />
      {serie.length ? (
        <>
          <h3 className="font-semibold">Série mensal deste correspondente</h3>
          <GraficoLinha
            data={serie}
            series={[
              { key: "Reclamações", color: "#05aaca" },
              { key: "Ações judiciais", color: "#112369" },
              { key: "Numerador Quadro 5", color: "#4b90e2" },
            ]}
          />
        </>
      ) : null}
      <h3 className="font-semibold">Alertas deste correspondente</h3>
      {meus.length ? (
        <ul className="list-disc pl-5 text-sm">
          {meus.map((a, i) => (
            <li key={i}>{a.mensagem}</li>
          ))}
        </ul>
      ) : (
        <p>Nenhum alerta neste mês.</p>
      )}
      <p className="rounded-[var(--radius-box)] bg-[#e8f4fc] p-3 text-sm">{acaoRelacionamento(meus)}</p>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-3">
      <div className="text-xs uppercase text-[var(--senff-grey)]">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
