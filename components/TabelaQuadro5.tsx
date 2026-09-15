"use client";

import { useMemo, useState } from "react";
import { PopupCaso } from "@/components/PopupCaso";
import { Chip, Tabela } from "@/components/ui";
import type { Alerta } from "@/lib/alertas";
import { historicoDoCorrespondente } from "@/lib/caso";
import type { Classificacao, ResumoAuditoria } from "@/lib/types";

export type LinhaQuadro5 = {
  id: string;
  c: string;
  cnpj: string;
  rec: string;
  aj: string;
  status: string;
};

export function TabelaQuadro5({
  linhas,
  hist,
  alertas,
  auditorias,
  mes,
}: {
  linhas: LinhaQuadro5[];
  hist: Classificacao[];
  alertas: Alerta[];
  auditorias: ResumoAuditoria[];
  mes: string;
}) {
  const [filtro, setFiltro] = useState<"todos" | "conforme" | "nao_conforme" | "nao_aplicavel">(
    "todos",
  );
  const [aberto, setAberto] = useState<string | null>(null);
  const visiveis = useMemo(
    () => (filtro === "todos" ? linhas : linhas.filter((r) => r.status === filtro)),
    [filtro, linhas],
  );
  const atual = aberto
    ? historicoDoCorrespondente(hist, aberto).find((h) => h.mes_referencia === mes) ||
      historicoDoCorrespondente(hist, aberto)[0] ||
      null
    : null;
  const historico = aberto ? historicoDoCorrespondente(hist, aberto) : [];

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
      <p className="text-sm text-[var(--senff-navy-text)]">
        Clique na linha para abrir o descritivo e o histórico daquele correspondente.
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
          _id: r.id,
          c: r.c,
          cnpj: r.cnpj,
          rec: r.rec,
          aj: r.aj,
          status: <Chip status={r.status} />,
        }))}
        onLinha={(row) => setAberto(String(row._id || ""))}
      />
      {atual ? (
        <PopupCaso
          atual={atual}
          historico={historico}
          alertas={alertas}
          auditorias={auditorias}
          onFechar={() => setAberto(null)}
        />
      ) : null}
    </div>
  );
}
