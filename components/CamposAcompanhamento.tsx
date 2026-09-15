"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { registrarAcompanhamento } from "@/app/actions";

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

export function CampoAcaoRealizada({
  correspondenteId,
  mes,
  chave,
  inicial,
  ehStaff,
}: {
  correspondenteId: string;
  mes: string;
  chave: string;
  inicial: boolean;
  ehStaff: boolean;
}) {
  const router = useRouter();
  const [feita, setFeita] = useState(inicial);
  const [pendente, start] = useTransition();

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">{feita ? "1" : "0"}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--senff-acqua)]"
        checked={feita}
        disabled={!ehStaff || pendente}
        onChange={(e) => {
          const next = e.target.checked;
          setFeita(next);
          start(async () => {
            const fd = new FormData();
            fd.set("correspondente_id", correspondenteId);
            fd.set("mes", mes);
            fd.set("chave", chave);
            fd.set("acao_realizada", next ? "true" : "false");
            if (next) fd.set("preencher_data_se_vazia", "true");
            await registrarAcompanhamento(fd);
            router.refresh();
          });
        }}
      />
      <span className="text-[var(--senff-navy-text)]">{feita ? "Sim" : "Não"}</span>
    </label>
  );
}

export function CampoDataAcao({
  correspondenteId,
  mes,
  chave,
  inicial,
  ehStaff,
}: {
  correspondenteId: string;
  mes: string;
  chave: string;
  inicial: string | null;
  ehStaff: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(inicial || "");
  const [pendente, start] = useTransition();
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  function gravar(valor: string) {
    const fd = new FormData();
    fd.set("correspondente_id", correspondenteId);
    fd.set("mes", mes);
    fd.set("chave", chave);
    fd.set("data_acao", valor);
    start(async () => {
      await registrarAcompanhamento(fd);
      router.refresh();
    });
  }

  return (
    <input
      type="date"
      className="rounded-[var(--radius-form)] border border-[var(--border)] px-2 py-1 text-sm disabled:bg-[var(--senff-light-grey)]"
      value={data}
      disabled={!ehStaff || pendente}
      max={hojeIso()}
      onChange={(e) => {
        const valor = e.target.value;
        setData(valor);
        if (t.current) clearTimeout(t.current);
        t.current = setTimeout(() => gravar(valor), 300);
      }}
    />
  );
}
