"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { queryPainel } from "@/lib/filtros";

export const NAV = [
  { href: "/", label: "Visão geral" },
  { href: "/correspondente", label: "Por correspondente" },
  { href: "/evolucao", label: "Evolução" },
  { href: "/relatoria", label: "Relatoria" },
  { href: "/monitoramento-anual", label: "Monitoramento anual" },
  { href: "/relacionamento", label: "Relacionamento" },
  { href: "/fechamento", label: "Fechamento mensal" },
  { href: "/auditorias", label: "Auditorias" },
  { href: "/medidas", label: "Medidas administrativas" },
];

export function Nav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const q = queryPainel({ mes: params.get("mes"), corban: params.get("corban") });
  if (compact) {
    return (
      <nav className="flex gap-2 overflow-auto text-sm">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={`${item.href}${q}`}
            className={`whitespace-nowrap rounded-full border px-3 py-1 ${
              pathname === item.href
                ? "border-[var(--senff-acqua)] bg-[var(--senff-acqua)] text-white"
                : "border-[var(--border)]"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-auto text-sm">
      {NAV.map((item) => {
        const ativo = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={`${item.href}${q}`}
            className={`rounded-lg px-3 py-2 ${
              ativo ? "bg-[var(--senff-acqua)] text-white" : "text-white/85 hover:bg-white/10"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
