"use client";

import { useState } from "react";
import { confirmarIndefinido } from "@/app/actions";
import { Tabela } from "@/components/ui";
import type { Indefinido } from "@/lib/types";

export function FilaIndefinidos({
  itens,
  ehStaff,
}: {
  itens: Indefinido[];
  ehStaff: boolean;
}) {
  const meses = [...new Set(itens.map((i) => i.ano_mes))].sort().reverse();
  const [mes, setMes] = useState(meses[0] || "");
  const filas = itens.filter((i) => i.ano_mes === mes);
  const [escolhido, setEscolhido] = useState(filas[0]?.id || "");
  const [destino, setDestino] = useState<"corban" | "senff">("corban");
  const [msg, setMsg] = useState<string | null>(null);
  const registro = filas.find((i) => i.id === escolhido) || filas[0];

  if (!meses.length) return <p>Nenhum caso indefinido na base.</p>;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Fila de indefinidos</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        O Navigate marca ~25% dos casos como Indefinido. Confirme Corban ou Senff sem inventar
        procedente: o motor só conta Corban + parecer procedente.
      </p>
      <label className="block max-w-xs text-sm">
        Mês da fila
        <select
          className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
          value={mes}
          onChange={(e) => {
            setMes(e.target.value);
            setMsg(null);
          }}
        >
          {meses.map((m) => (
            <option key={m} value={m}>
              {m.slice(0, 7)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-2xl font-semibold">{filas.length} indefinidos neste mês</p>
      <Tabela
        colunas={[
          { chave: "fonte", titulo: "Fonte" },
          { chave: "protocolo", titulo: "Protocolo" },
          { chave: "correspondente", titulo: "Correspondente" },
          { chave: "canal", titulo: "Canal" },
          { chave: "encerrado_em", titulo: "Encerrado em" },
          { chave: "parecer", titulo: "Parecer" },
        ]}
        linhas={filas.map((r) => ({
          fonte: r.fonte,
          protocolo: r.protocolo,
          correspondente: r.correspondente,
          canal: r.canal,
          encerrado_em: r.encerrado_em || "—",
          parecer: (r.parecer || "—").slice(0, 120),
        }))}
      />
      {!ehStaff ? (
        <p className="text-sm">Somente a área de Qualidade confirma a atribuição.</p>
      ) : registro ? (
        <form
          className="space-y-3 rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-4"
          action={async (fd) => {
            const r = filas.find((i) => i.id === (fd.get("id") as string)) || registro;
            fd.set("tabela", r.tabela);
            fd.set("parecer", r.parecer || "");
            fd.set("mes", r.ano_mes);
            const out = await confirmarIndefinido(fd);
            setMsg(out.ok ? `Protocolo ${r.protocolo} → ${fd.get("destino")}. Mês reclassificado.` : out.erro);
          }}
        >
          <label className="block text-sm">
            Caso a confirmar
            <select
              name="id"
              className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
              value={registro.id}
              onChange={(e) => setEscolhido(e.target.value)}
            >
              {filas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fonte} · {r.protocolo} · {r.correspondente}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="text-sm">
            <legend className="mb-1">Atribuir a</legend>
            <label className="mr-4">
              <input
                type="radio"
                name="destino"
                value="corban"
                checked={destino === "corban"}
                onChange={() => setDestino("corban")}
              />{" "}
              Correspondente (Corban)
            </label>
            <label>
              <input
                type="radio"
                name="destino"
                value="senff"
                checked={destino === "senff"}
                onChange={() => setDestino("senff")}
              />{" "}
              Senff
            </label>
          </fieldset>
          <p className="text-sm">Parecer atual: {registro.parecer || "—"}</p>
          <button className="btn-primary" type="submit">
            Confirmar atribuição e reclassificar o mês
          </button>
          {msg ? <p className="text-sm">{msg}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
