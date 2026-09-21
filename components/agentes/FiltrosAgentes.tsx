"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { queryPainel, type AgenteOpcao } from "@/lib/agentes/filtros";

export function FiltrosAgentes({
  meses,
  agentes,
}: {
  meses: string[];
  agentes: AgenteOpcao[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const mesAtual = params.get("mes") || meses[0] || "";
  const cpfAtual = params.get("cpf") || "";

  function ir(next: { mes?: string | null; cpf?: string | null }) {
    router.push(`${pathname}${queryPainel(next)}`);
  }

  if (!meses.length) return null;

  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="block min-w-[12rem] text-sm font-medium text-[var(--senff-navy-text)]">
        Mês de referência
        <select
          className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] bg-white px-3 py-2 text-[var(--senff-navy)]"
          value={mesAtual}
          onChange={(e) => ir({ mes: e.target.value, cpf: cpfAtual || null })}
        >
          {meses.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="block min-w-[16rem] text-sm font-medium text-[var(--senff-navy-text)]">
        Agente (CPF)
        <select
          className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] bg-white px-3 py-2 text-[var(--senff-navy)]"
          value={cpfAtual}
          onChange={(e) => ir({ mes: mesAtual || null, cpf: e.target.value || null })}
        >
          <option value="">Todos</option>
          {agentes.map((a) => (
            <option key={a.cpf} value={a.cpf}>
              {a.nome} · {a.mascara}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
