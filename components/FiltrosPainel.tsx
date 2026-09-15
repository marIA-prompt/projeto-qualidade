"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { queryPainel, type CorrespondenteOpcao } from "@/lib/filtros";

export function FiltrosPainel({
  meses,
  correspondentes,
}: {
  meses: string[];
  correspondentes: CorrespondenteOpcao[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const mesAtual = params.get("mes") || meses[0] || "";
  const corbanAtual = params.get("corban") || "";

  function ir(next: { mes?: string | null; corban?: string | null }) {
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
          onChange={(e) => ir({ mes: e.target.value, corban: corbanAtual || null })}
        >
          {meses.map((m) => (
            <option key={m} value={m}>
              {m.slice(0, 7)}
            </option>
          ))}
        </select>
      </label>
      <label className="block min-w-[16rem] text-sm font-medium text-[var(--senff-navy-text)]">
        Correspondente
        <select
          className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] bg-white px-3 py-2 text-[var(--senff-navy)]"
          value={corbanAtual}
          onChange={(e) => ir({ mes: mesAtual || null, corban: e.target.value || null })}
        >
          <option value="">Todos</option>
          {correspondentes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** @deprecated use FiltrosPainel */
export function MesSeletor({ meses }: { meses: string[] }) {
  return <FiltrosPainel meses={meses} correspondentes={[]} />;
}
