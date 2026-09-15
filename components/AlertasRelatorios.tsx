"use client";

import { useState } from "react";
import { registrarRelatorio } from "@/app/actions";
import { Tabela } from "@/components/ui";
import { ROTULOS_SEV } from "@/lib/format";
import { montarRelatorioMensal } from "@/lib/relatorios";
import type { Alerta } from "@/lib/alertas";
import type { Classificacao } from "@/lib/types";

export function AlertasRelatorios({
  mes,
  df,
  alertas,
  historico,
  ehStaff,
}: {
  mes: string;
  df: Classificacao[];
  alertas: Alerta[];
  historico: { created_at: string; mes_referencia: string | null; destinatario: string; assunto: string; status: string; erro: string | null }[];
  ehStaff: boolean;
}) {
  const nomes = ["Todos", ...[...new Set(df.map((r) => r.correspondente))].sort()];
  const [alvo, setAlvo] = useState("Todos");
  const [dest, setDest] = useState("maria.morais@senff.com.br");
  const [msg, setMsg] = useState<string | null>(null);
  const recorte = alvo === "Todos" ? df : df.filter((r) => r.correspondente === alvo);
  const recorteAlertas =
    alvo === "Todos"
      ? alertas
      : alertas.filter((a) => recorte.some((r) => r.correspondente_id === a.correspondente_id));
  const { assunto, corpo } = montarRelatorioMensal({
    mes,
    linhas: recorte,
    alertas: recorteAlertas,
    correspondente: alvo === "Todos" ? null : alvo,
  });
  const nC = alertas.filter((a) => a.severidade === "critico").length;
  const nA = alertas.filter((a) => a.severidade === "atencao").length;
  const nI = alertas.filter((a) => a.severidade === "info").length;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Alertas automatizados</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        Disparo automático: não conforme, 80% do teto de 0,03%, ≥ 3 reclamações/mês, indefinidas ou auditoria pendente.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Críticos" value={nC} />
        <Stat label="Atenção" value={nA} />
        <Stat label="Informativos" value={nI} />
      </div>
      <Tabela
        colunas={[
          { chave: "sev", titulo: "Severidade" },
          { chave: "c", titulo: "Correspondente" },
          { chave: "t", titulo: "Tipo" },
          { chave: "m", titulo: "Mensagem" },
        ]}
        linhas={alertas.map((a) => ({
          sev: ROTULOS_SEV[a.severidade] || a.severidade,
          c: a.correspondente,
          t: a.tipo,
          m: a.mensagem,
        }))}
      />
      <h2 className="text-xl font-semibold">Relatório mensal</h2>
      <label className="block text-sm">
        Escopo do relatório
        <select
          className="mt-1 w-full max-w-md rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
          value={alvo}
          onChange={(e) => setAlvo(e.target.value)}
        >
          {nomes.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Enviar para
        <input
          className="mt-1 w-full max-w-md rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
          value={dest}
          onChange={(e) => setDest(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <a
          className="btn-primary inline-block"
          href={`data:text/markdown;charset=utf-8,${encodeURIComponent(corpo)}`}
          download={`relatorio_qualidade_${mes.slice(0, 7)}.md`}
        >
          Baixar relatório (.md)
        </a>
        {ehStaff ? (
          <form
            action={async (fd) => {
              fd.set("mes", mes);
              fd.set("destinatario", dest);
              fd.set("correspondente", alvo === "Todos" ? "" : alvo);
              const r = await registrarRelatorio(fd);
              setMsg(r.erro || "Registrado.");
            }}
          >
            <button className="btn-primary" type="submit">
              Registrar envio
            </button>
          </form>
        ) : null}
      </div>
      {msg ? <p className="text-sm">{msg}</p> : null}
      <details className="rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-3">
        <summary className="cursor-pointer font-medium">Prévia do relatório</summary>
        <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">{corpo}</pre>
      </details>
      <p className="text-xs text-[var(--senff-grey)]">Assunto: {assunto}</p>
      {ehStaff ? (
        <>
          <h2 className="text-xl font-semibold">Histórico de envios</h2>
          {historico.length ? (
            <Tabela
              colunas={[
                { chave: "quando", titulo: "Quando" },
                { chave: "mes", titulo: "Mês" },
                { chave: "para", titulo: "Para" },
                { chave: "assunto", titulo: "Assunto" },
                { chave: "status", titulo: "Status" },
                { chave: "erro", titulo: "Erro" },
              ]}
              linhas={historico.map((h) => ({
                quando: (h.created_at || "").slice(0, 19).replace("T", " "),
                mes: (h.mes_referencia || "").slice(0, 7),
                para: h.destinatario,
                assunto: h.assunto,
                status: h.status,
                erro: h.erro || "—",
              }))}
            />
          ) : (
            <p className="text-sm">Nenhum relatório registrado ainda.</p>
          )}
        </>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-3">
      <div className="text-xs uppercase text-[var(--senff-grey)]">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
