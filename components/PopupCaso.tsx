"use client";

import { useEffect } from "react";
import { GraficoLinha } from "@/components/Charts";
import { Chip, Tabela } from "@/components/ui";
import { acaoRelacionamento, type Alerta } from "@/lib/alertas";
import {
  auditoriasDoCorrespondente,
  rotuloMes,
  textoDescritivo,
  textoIndice,
} from "@/lib/caso";
import type { Classificacao, ResumoAuditoria } from "@/lib/types";

export function PopupCaso({
  atual,
  historico,
  alertas,
  auditorias,
  onFechar,
}: {
  atual: Classificacao;
  historico: Classificacao[];
  alertas: Alerta[];
  auditorias: ResumoAuditoria[];
  onFechar: () => void;
}) {
  const meusAlertas = alertas.filter((a) => a.correspondente_id === atual.correspondente_id);
  const meusAud = auditoriasDoCorrespondente(auditorias, atual.correspondente_id);
  const serie = [...historico]
    .sort((a, b) => a.mes_referencia.localeCompare(b.mes_referencia))
    .map((h) => ({
      mes: rotuloMes(h.mes_referencia),
      Reclamações: h.qtd_reclamacoes,
      "Ações judiciais": h.qtd_acoes_judiciais,
      Numerador: h.numerador,
    }));

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#112369]/50 p-4"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="caso-titulo"
        className="relative my-8 w-full max-w-3xl rounded-[var(--radius-box)] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="caso-titulo" className="text-xl font-semibold">
              {atual.correspondente}
            </h2>
            <p className="text-sm text-[var(--senff-navy-text)]">
              CNPJ {atual.cnpj} · {rotuloMes(atual.mes_referencia)} · <Chip status={atual.status} />
            </p>
          </div>
          <button
            type="button"
            className="rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-1 text-sm"
            onClick={onFechar}
          >
            Fechar
          </button>
        </div>

        <h3 className="mb-2 font-semibold">Descritivo</h3>
        <p className="text-sm text-[var(--senff-navy-text)]">{textoDescritivo(atual)}</p>
        {meusAlertas.length ? (
          <ul className="mt-3 list-disc pl-5 text-sm">
            {meusAlertas.map((a, i) => (
              <li key={i}>{a.mensagem}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 rounded-[var(--radius-box)] bg-[#e8f4fc] p-3 text-sm">
          {acaoRelacionamento(meusAlertas)}
        </p>

        <h3 className="mb-2 mt-5 font-semibold">Auditorias</h3>
        <Tabela
          colunas={[
            { chave: "tipo", titulo: "Tipo" },
            { chave: "data", titulo: "Data" },
            { chave: "pilares", titulo: "Pilares" },
            { chave: "media", titulo: "Média" },
          ]}
          linhas={meusAud.map((a) => ({
            tipo: a.tipo,
            data: a.data || "—",
            pilares: a.pilares,
            media: a.media ?? "—",
          }))}
        />

        <h3 className="mb-2 mt-5 font-semibold">Histórico mensal</h3>
        <Tabela
          colunas={[
            { chave: "mes", titulo: "Mês" },
            { chave: "rec", titulo: "Reclamações" },
            { chave: "aj", titulo: "Ações" },
            { chave: "num", titulo: "Numerador" },
            { chave: "cart", titulo: "Carteira" },
            { chave: "idx", titulo: "Índice" },
            { chave: "st", titulo: "Status" },
          ]}
          linhas={historico.map((h) => ({
            mes: rotuloMes(h.mes_referencia),
            rec: h.qtd_reclamacoes,
            aj: h.qtd_acoes_judiciais,
            num: h.numerador,
            cart: h.carteira_denominador ?? "—",
            idx: textoIndice(h.indice),
            st: <Chip status={h.status} />,
          }))}
        />
        {serie.length > 1 ? (
          <div className="mt-4">
            <GraficoLinha
              data={serie}
              series={[
                { key: "Reclamações", color: "#05aaca" },
                { key: "Ações judiciais", color: "#112369" },
                { key: "Numerador", color: "#4b90e2" },
              ]}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
