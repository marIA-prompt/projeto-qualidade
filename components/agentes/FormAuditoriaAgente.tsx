"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarAuditoriaAgente } from "@/lib/agentes/actions";
import { PILARES, ROTULOS_NOTA, SUBCRITERIOS, pontuacaoPilar } from "@/lib/pilares";
import type { AgenteOpcao } from "@/lib/agentes/filtros";

export function FormAuditoriaAgente({
  agentes,
  cpfInicial,
}: {
  agentes: AgenteOpcao[];
  cpfInicial?: string | null;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"externa" | "interna">("externa");
  const [pilar, setPilar] = useState("relacionamento_cliente");
  const subs = SUBCRITERIOS[pilar];
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pontuacao = useMemo(() => pontuacaoPilar(notas), [notas]);

  return (
    <form
      className="space-y-3 rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-4"
      action={async (fd) => {
        fd.set("tipo", tipo);
        fd.set("pilar", pilar);
        for (const [k, v] of Object.entries(notas)) fd.set(`sub_${k}`, v);
        const r = await registrarAuditoriaAgente(fd);
        setMsg(r.ok ? "Auditoria gravada no dossiê do CPF (não altera índice nem MCB)." : r.erro);
        if (r.ok) {
          setArquivo(null);
          if (inputRef.current) inputRef.current.value = "";
          router.refresh();
        }
      }}
    >
      <h2 className="text-xl font-semibold">Registrar resultado de auditoria</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        Entrada manual por pilar, chave CPF. A pontuação é a média dos subcritérios (ok=100,
        parcial=50, não ok=0). Fica no dossiê do agente — <strong>não</strong> entra no índice do
        Quadro 6 nem no MCB. Não grava nas tabelas de correspondente (CNPJ).
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
        Agente (CPF)
        <select
          name="cpf_agente"
          required
          defaultValue={cpfInicial || ""}
          className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
        >
          <option value="">Selecione o agente</option>
          {agentes.map((a) => (
            <option key={a.cpf} value={a.cpf}>
              {a.nome} · {a.mascara}
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
      <input
        ref={inputRef}
        type="file"
        name="anexo"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => setArquivo(e.target.files?.[0] || null)}
      />
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-[var(--radius-box)] border-2 border-dashed border-[var(--senff-acqua)] bg-[#e8f7fb] px-4 py-3 text-left hover:bg-[#d7f1f8]"
        onClick={() => inputRef.current?.click()}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--senff-acqua)] text-xs font-bold text-white">
          PDF
        </span>
        <span>
          <span className="block font-semibold text-[var(--senff-navy)]">Anexar relatório da auditoria</span>
          <span className="text-sm text-[var(--senff-navy-text)]">
            {arquivo ? arquivo.name : "Clique para escolher um arquivo PDF"}
          </span>
        </span>
      </button>
      <button className="btn-primary" type="submit">
        Gravar auditoria
      </button>
      {msg ? <p className="text-sm">{msg}</p> : null}
    </form>
  );
}
