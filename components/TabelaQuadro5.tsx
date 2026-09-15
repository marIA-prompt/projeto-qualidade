"use client";

import { useMemo, useState } from "react";
import { Chip, Tabela } from "@/components/ui";

export type LinhaQuadro5 = {
  c: string;
  cnpj: string;
  rec: string;
  aj: string;
  status: string;
};

export function TabelaQuadro5({ linhas }: { linhas: LinhaQuadro5[] }) {
  const [filtro, setFiltro] = useState<"todos" | "conforme" | "nao_conforme" | "nao_aplicavel">(
    "todos",
  );
  const visiveis = useMemo(
    () => (filtro === "todos" ? linhas : linhas.filter((r) => r.status === filtro)),
    [filtro, linhas],
  );

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ["todos", "Todos"],
            ["conforme", "Conforme < 0,03%"],
            ["nao_conforme", "Não conforme ≥ 0,03%"],
            ["nao_aplicavel", "Não aplicável — sem carteira"],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltro(id)}
            className={`chip ${
              id === "conforme" ? "chip-ok" : id === "nao_conforme" ? "chip-danger" : "chip-off"
            } ${filtro === id ? "ring-2 ring-[var(--senff-acqua)]" : ""}`}
          >
            {rotulo}
          </button>
        ))}
      </p>
      <Tabela
        colunas={[
          { chave: "c", titulo: "Correspondente" },
          { chave: "cnpj", titulo: "CNPJ" },
          { chave: "rec", titulo: "Reclamações" },
          { chave: "aj", titulo: "Ações judiciais" },
          { chave: "status", titulo: "Status mensal (Quadro 5)" },
        ]}
        linhas={visiveis.map((r) => ({
          c: r.c,
          cnpj: r.cnpj,
          rec: r.rec,
          aj: r.aj,
          status: <Chip status={r.status} />,
        }))}
      />
    </div>
  );
}
