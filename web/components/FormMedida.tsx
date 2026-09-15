"use client";

import { useState } from "react";
import { registrarMedida } from "@/app/actions";

function rotuloMedida(m: { nivel: number | null; descricao: string | null }) {
  if (m.nivel) return `Nível ${m.nivel} — ${m.descricao || "—"}`;
  if (m.descricao) return `${m.descricao} (discricionária)`;
  return "—";
}

export function FormMedida({
  correspondentes,
  medidas,
  classifPorCorr,
}: {
  correspondentes: { id: string; nome: string; cnpj: string }[];
  medidas: { id: number; nivel: number | null; descricao: string | null }[];
  classifPorCorr: Record<string, string>;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="space-y-3 rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-4"
      action={async (fd) => {
        const cid = String(fd.get("correspondente_id") || "");
        if (classifPorCorr[cid]) fd.set("classificacao_id", classifPorCorr[cid]);
        const r = await registrarMedida(fd);
        setMsg(r.ok ? "Medida registrada com sucesso." : r.erro);
      }}
    >
      <h2 className="text-xl font-semibold">Registrar medida administrativa aplicada</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        A decisão de qual medida aplicar é sempre da Gestora de Qualidade — o sistema apenas registra.
      </p>
      <label className="block text-sm">
        Correspondente
        <select
          name="correspondente_id"
          required
          className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
        >
          {correspondentes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} ({c.cnpj})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Medida
        <select
          name="medida_id"
          required
          className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
        >
          {medidas.map((m) => (
            <option key={m.id} value={m.id}>
              {rotuloMedida(m)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Data de aplicação
        <input
          type="date"
          name="data_aplicacao"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="mt-1 rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
        />
      </label>
      <textarea
        name="motivo"
        placeholder="Motivo / contexto (auditável)"
        className="w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
      />
      <button className="btn-primary" type="submit">
        Registrar
      </button>
      {msg ? <p className="text-sm">{msg}</p> : null}
    </form>
  );
}
