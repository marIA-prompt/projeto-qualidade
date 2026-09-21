"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { queryPainel } from "@/lib/agentes/filtros";

export const NAV_AGENTES = [
  { href: "/agentes", label: "Visão geral" },
  { href: "/agentes/agente", label: "Por agente" },
  { href: "/agentes/evolucao", label: "Evolução" },
  { href: "/agentes/monitoramento-anual", label: "Monitoramento anual" },
  { href: "/agentes/fechamento", label: "Fechamento mensal" },
  { href: "/agentes/pontuacao-mcb", label: "Pontuação MCB" },
  { href: "/agentes/fraude-104", label: "Fraude 104" },
  { href: "/agentes/auditorias", label: "Auditorias" },
  { href: "/agentes/consulta", label: "Consulta do agente" },
];

export function NavAgentes({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const q = queryPainel({ mes: params.get("mes"), cpf: params.get("cpf") });
  if (compact) {
    return (
      <nav className="flex gap-2 overflow-auto text-sm">
        {NAV_AGENTES.map((item) => (
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
      {NAV_AGENTES.map((item) => {
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
