"use client";

import { useMemo, useState } from "react";
import { registrarAuditoria } from "@/app/actions";
import { PILARES, ROTULOS_NOTA, SUBCRITERIOS, pontuacaoPilar } from "@/lib/pilares";

export function FormAuditoria({
  correspondentes,
}: {
  correspondentes: { id: string; nome: string; cnpj: string }[];
}) {
  const [tipo, setTipo] = useState<"externa" | "interna">("externa");
  const [pilar, setPilar] = useState("relacionamento_cliente");
  const subs = SUBCRITERIOS[pilar];
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const pontuacao = useMemo(() => pontuacaoPilar(notas), [notas]);

  return (
    <form
      className="space-y-3 rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-4"
      action={async (fd) => {
        fd.set("tipo", tipo);
        fd.set("pilar", pilar);
        for (const [k, v] of Object.entries(notas)) fd.set(`sub_${k}`, v);
        const r = await registrarAuditoria(fd);
        setMsg(r.ok ? "Auditoria gravada." : r.erro);
      }}
    >
      <h2 className="text-xl font-semibold">Registrar resultado de auditoria</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        Entrada manual por pilar (FR-3). A pontuação é a média dos subcritérios (ok=100, parcial=50,
        não ok=0). Isso ainda não dispara o Quadro 3 anual.
      </p>
      <label className="block text-sm">
        Tipo
        <select
          className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as "externa" | "interna")}
        >
          <option value="externa">Auditoria externa</option>
          <option value="interna">Auditoria interna</option>
        </select>
      </label>
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
        Pilar
        <select
          className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
          value={pilar}
          onChange={(e) => {
            setPilar(e.target.value);
            setNotas({});
          }}
        >
          {Object.entries(PILARES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Data da avaliação
        <input
          type="date"
          name="data_avaliacao"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="mt-1 rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
        />
      </label>
      <div className="space-y-2">
        <p className="font-medium">Subcritérios</p>
        {Object.entries(subs).map(([k, rotulo]) => (
          <label key={k} className="block text-sm">
            {rotulo}
            <select
              className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
              value={notas[k] || "nao_avaliado"}
              onChange={(e) => setNotas((prev) => ({ ...prev, [k]: e.target.value }))}
            >
              {Object.entries(ROTULOS_NOTA).map(([vk, vr]) => (
                <option key={vk} value={vk}>
                  {vr}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="text-sm">
        Pontuação do pilar: {pontuacao == null ? "nenhum subcritério avaliado" : pontuacao}
      </p>
      <textarea
        name="observacoes"
        placeholder="Observações (auditável)"
        className="w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
      />
      <button className="btn-primary" type="submit">
        Gravar auditoria
      </button>
      {msg ? <p className="text-sm">{msg}</p> : null}
    </form>
  );
}
