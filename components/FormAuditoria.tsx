"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarAuditoria } from "@/app/actions";
import { pdfAuditoriaValido } from "@/lib/auditoriaAnexo";
import { PILARES } from "@/lib/pilares";

export function FormAuditoria({
  correspondentes,
}: {
  correspondentes: { id: string; nome: string; cnpj: string }[];
}) {
  const [tipo, setTipo] = useState<"externa" | "interna">("externa");
  const [pilar, setPilar] = useState("relacionamento_cliente");
  const [msg, setMsg] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  return (
    <form
      className="space-y-3 rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-4"
      action={async (fd) => {
        if (arquivo) {
          const rejeicao = pdfAuditoriaValido(arquivo);
          if (rejeicao) {
            setMsg(rejeicao);
            return;
          }
        }
        fd.set("tipo", tipo);
        fd.set("pilar", pilar);
        const r = await registrarAuditoria(fd);
        setMsg(r.ok ? "Auditoria gravada." : r.erro);
        if (r.ok) {
          setArquivo(null);
          if (inputRef.current) inputRef.current.value = "";
          router.refresh();
        }
      }}
    >
      <h2 className="text-xl font-semibold">Registrar resultado de auditoria</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        Fiel ao relatório oficial: os 5 pilares, as observações da EY e a pontuação
        final digitada (ex.: 92%). Sem subcritérios e sem média automática. A nota
        entra na pontuação qualitativa do monitoramento anual.
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
          onChange={(e) => setPilar(e.target.value)}
        >
          {Object.entries(PILARES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-[var(--senff-navy-text)]">
        Critério geral do relatório — somente os 5 pilares, sem detalhar subcritério.
      </p>
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
      <label className="block text-sm">
        Observações da EY — Auditoria
        <textarea
          name="observacoes"
          rows={6}
          placeholder="Cole aqui as informações e achados do relatório oficial"
          className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Pontuação da auditoria (%)
        <input
          type="number"
          name="pontuacao"
          min={0}
          max={100}
          step={0.01}
          inputMode="decimal"
          placeholder="Ex.: 92"
          className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
        />
      </label>
      <p className="text-xs text-[var(--senff-navy-text)]">
        Digite o percentual do relatório (pontuação final). Não calculamos a partir de
        subcritérios.
      </p>
      <input
        ref={inputRef}
        type="file"
        name="anexo"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          if (f) {
            const rejeicao = pdfAuditoriaValido(f);
            if (rejeicao) {
              setMsg(rejeicao);
              setArquivo(null);
              e.target.value = "";
              return;
            }
          }
          setArquivo(f);
        }}
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
