"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function MesSeletor({ meses }: { meses: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const atual = params.get("mes") || meses[0] || "";
  if (!meses.length) return null;
  return (
    <label className="block max-w-xs text-sm font-medium text-[var(--senff-navy-text)]">
      Mês de referência
      <select
        className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] bg-white px-3 py-2 text-[var(--senff-navy)]"
        value={atual}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("mes", e.target.value);
          router.push(`${pathname}?${next.toString()}`);
        }}
      >
        {meses.map((m) => (
          <option key={m} value={m}>
            {m.slice(0, 7)}
          </option>
        ))}
      </select>
    </label>
  );
}
