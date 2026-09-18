"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { excluirAuditoria } from "@/app/actions";
import { Tabela } from "@/components/ui";

export type LinhaAuditoria = {
  id: string;
  tabela: "auditorias_externas" | "auditorias_internas";
  Tipo: string;
  Data: string;
  Correspondente: string;
  Pilar: string;
  Pontuação: string | number;
  Observações: string;
  Anexo: string;
};

export function ListaAuditorias({
  linhas,
  ehStaff,
}: {
  linhas: LinhaAuditoria[];
  ehStaff: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, start] = useTransition();

  const visiveis = linhas.map((r) => {
    const row: Record<string, unknown> = {
      Tipo: r.Tipo,
      Data: r.Data,
      Correspondente: r.Correspondente,
      Pilar: r.Pilar,
      Pontuação: r.Pontuação,
      Observações: r.Observações,
      Anexo: r.Anexo,
    };
    if (ehStaff) {
      row.Ações = (
        <button
          type="button"
          className="rounded-[var(--radius-form)] border border-[var(--danger)] px-3 py-1 text-sm font-semibold text-[var(--danger)] hover:bg-[#fdecef] disabled:opacity-50"
          disabled={pendente}
          onClick={() => {
            if (
              !window.confirm(
                `Excluir a auditoria de ${r.Correspondente} (${r.Pilar} em ${r.Data})? Esta ação não tem volta.`,
              )
            ) {
              return;
            }
            start(async () => {
              const fd = new FormData();
              fd.set("id", r.id);
              fd.set("tabela", r.tabela);
              const res = await excluirAuditoria(fd);
              setMsg(res.ok ? "Auditoria excluída." : res.erro);
              if (res.ok) router.refresh();
            });
          }}
        >
          Excluir
        </button>
      );
    }
    return row;
  });

  const colunas = [
    { chave: "Tipo", titulo: "Tipo" },
    { chave: "Data", titulo: "Data" },
    { chave: "Correspondente", titulo: "Correspondente" },
    { chave: "Pilar", titulo: "Pilar" },
    { chave: "Pontuação", titulo: "Pontuação" },
    { chave: "Observações", titulo: "Observações" },
    { chave: "Anexo", titulo: "Anexo" },
    ...(ehStaff ? [{ chave: "Ações", titulo: "Ações" }] : []),
  ];

  return (
    <div className="space-y-2">
      <Tabela colunas={colunas} linhas={visiveis} />
      {msg ? <p className="text-sm">{msg}</p> : null}
    </div>
  );
}
