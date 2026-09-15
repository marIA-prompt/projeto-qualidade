import { Suspense } from "react";
import { BotaoSair } from "./BotaoSair";
import { MesSeletor } from "./MesSeletor";
import { Nav } from "./Nav";

export function Shell(props: {
  email: string;
  papel: string;
  meses: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--senff-light-grey)] text-[var(--senff-navy)]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[var(--senff-navy)] p-5 text-white md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-senff-branca.png" alt="Banco Senff" className="mb-6 h-10 w-auto" />
        <p className="text-sm font-semibold">Qualidade de Correspondentes</p>
        <p className="mt-1 truncate text-xs text-white/75">{props.email}</p>
        <p className="mb-6 text-xs text-white/60">
          {props.papel === "staff" ? "Qualidade/Compliance" : "Correspondente"}
        </p>
        <Suspense>
          <Nav />
        </Suspense>
        <div className="mt-4">
          <BotaoSair />
        </div>
      </aside>
      <div className="md:pl-64">
        <header className="bg-[var(--senff-navy)] px-6 py-4 text-white">
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-senff-branca.png" alt="" className="h-11 w-auto md:hidden" />
            <div>
              <h1 className="text-lg font-semibold">Plano de Qualidade de Correspondentes</h1>
              <p className="text-sm text-white/80">
                Autorregulação do Crédito Consignado — 4 indicadores obrigatórios
                (Reclamações, Ações Judiciais, Auditorias Externas e Internas).
              </p>
            </div>
          </div>
        </header>
        <div className="border-b border-[var(--border)] bg-white px-6 py-3 md:hidden">
          <Suspense>
            <Nav compact />
          </Suspense>
        </div>
        <main className="mx-auto max-w-6xl space-y-4 p-6">
          <Suspense>
            <MesSeletor meses={props.meses} />
          </Suspense>
          <div className="rounded-[var(--radius-box)] border border-[#a9d7eb] bg-[#e8f4fc] p-4 text-sm">
            <strong>Requisitos Bruna Camargo — cobertos neste painel</strong>
            <ul className="mt-2 list-disc pl-5">
              <li>Painel visual por correspondente</li>
              <li>Alertas automatizados nas métricas</li>
              <li>Envio / download de relatórios mensais</li>
              <li>Vertente de relacionamento antes da sanção</li>
              <li>Fila de indefinidos sem inventar procedente</li>
            </ul>
          </div>
          {props.children}
        </main>
      </div>
    </div>
  );
}

export function Kpis({
  cards,
}: {
  cards: { label: string; value: string; hint?: string; tone?: string }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-4 shadow-sm kpi-${c.tone || "acqua"}`}
        >
          <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--senff-grey)]">
            {c.label}
          </div>
          <div className="mt-1 text-3xl font-semibold">{c.value}</div>
          {c.hint ? <div className="text-sm text-[var(--senff-navy-text)]">{c.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function Chip({ status }: { status: string }) {
  const map: Record<string, string> = {
    conforme: "chip-ok",
    nao_conforme: "chip-danger",
    nao_aplicavel: "chip-off",
  };
  const rotulo: Record<string, string> = {
    conforme: "Conforme",
    nao_conforme: "Não conforme",
    nao_aplicavel: "Não aplicável",
  };
  return <span className={`chip ${map[status] || "chip-off"}`}>{rotulo[status] || status}</span>;
}

export function Tabela({
  colunas,
  linhas,
}: {
  colunas: { chave: string; titulo: string }[];
  linhas: Record<string, unknown>[];
}) {
  return (
    <div className="overflow-auto rounded-[var(--radius-box)] border border-[var(--border)] bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[var(--senff-light-grey)] text-[var(--senff-navy-text)]">
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} className="px-3 py-2 font-semibold">
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((row, i) => (
            <tr key={i} className="border-t border-[var(--border)]">
              {colunas.map((c) => (
                <td key={c.chave} className="px-3 py-2 align-top">
                  {row[c.chave] as React.ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
