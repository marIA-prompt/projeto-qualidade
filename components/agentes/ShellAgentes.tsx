import { Suspense } from "react";
import { BotaoSair } from "@/components/BotaoSair";
import { SeletorProduto } from "@/components/SeletorProduto";
import { FiltrosAgentes } from "./FiltrosAgentes";
import { NavAgentes } from "./NavAgentes";
import type { AgenteOpcao } from "@/lib/agentes/filtros";

export function ShellAgentes(props: {
  email: string;
  papel: string;
  meses: string[];
  agentes: AgenteOpcao[];
  children: React.ReactNode;
}) {
  const staff = props.papel === "staff";

  return (
    <div className="min-h-screen bg-[var(--senff-light-grey)] text-[var(--senff-navy)]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[var(--senff-navy)] p-5 text-white md:flex">
        <div className="mb-6 inline-flex w-fit rounded-lg bg-white px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-senff.png" alt="Banco Senff" className="h-12 w-auto" />
        </div>
        <p className="text-sm font-semibold">Qualidade de Agentes de Crédito</p>
        <p className="mt-1 truncate text-xs text-white/75">{props.email}</p>
        <p className="mb-4 text-xs text-white/60">
          {staff ? "Qualidade/Compliance" : "Consulta do agente"}
        </p>
        <Suspense>
          <SeletorProduto />
        </Suspense>
        <Suspense>
          <NavAgentes />
        </Suspense>
        <div className="mt-4">
          <BotaoSair />
        </div>
      </aside>
      <div className="md:pl-64">
        <header className="bg-[var(--senff-navy)] px-6 py-4 text-white">
          <div className="flex flex-wrap items-center gap-4">
            <div className="inline-flex rounded-lg bg-white px-2.5 py-1.5 md:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-senff.png" alt="Banco Senff" className="h-10 w-auto" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Plano de Qualidade de Agentes de Crédito</h1>
              <p className="text-sm text-white/80">
                Banco Senff · Autorregulação do Crédito Consignado (FEBRABAN)
              </p>
            </div>
          </div>
        </header>
        <div className="border-b border-[var(--border)] bg-white px-6 py-3 md:hidden">
          <Suspense>
            <SeletorProduto compact />
          </Suspense>
          <Suspense>
            <NavAgentes compact />
          </Suspense>
        </div>
        <main className="mx-auto max-w-6xl space-y-4 p-6">
          <Suspense>
            <FiltrosAgentes meses={props.meses} agentes={props.agentes} />
          </Suspense>
          {props.children}
        </main>
      </div>
    </div>
  );
}
