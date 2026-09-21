"use client";

import { usePathname } from "next/navigation";

const ITENS = [
  { id: "correspondentes" as const, href: "/", label: "Correspondentes", curto: "Correspondentes" },
  {
    id: "agentes" as const,
    href: "/agentes",
    label: "Agentes de Crédito / Digitadores",
    curto: "Agentes / Digitadores",
  },
];

export function SeletorProduto({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const ativo = pathname.startsWith("/agentes") ? "agentes" : "correspondentes";

  if (compact) {
    return (
      <div className="mb-2 flex gap-2 overflow-auto">
        {ITENS.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${
              item.id === ativo
                ? "border-[var(--senff-acqua)] bg-[var(--senff-acqua)] text-white"
                : "border-[var(--border)]"
            }`}
          >
            {item.curto}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-1">
      <p className="px-1 text-[0.65rem] font-semibold uppercase tracking-wide text-white/50">
        Visualização
      </p>
      {ITENS.map((item) => (
        <a
          key={item.id}
          href={item.href}
          className={`block rounded-lg px-3 py-2 text-sm ${
            item.id === ativo ? "bg-[var(--senff-acqua)] text-white" : "text-white/85 hover:bg-white/10"
          }`}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}
