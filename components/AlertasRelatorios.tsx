"use client";

import { useMemo, useState, useTransition } from "react";
import { gerarERegistrarRelatorio } from "@/app/actions";
import { Tabela } from "@/components/ui";
import { CRITERIOS_SEVERIDADE, type Alerta } from "@/lib/alertas";
import { ROTULOS_SEV } from "@/lib/format";
import {
  montarDadosRelatorio,
  relatorioHtml,
  type MedidaHistorico,
} from "@/lib/relatorioModelo";
import type { Classificacao } from "@/lib/types";

function baixarArquivo(filename: string, mime: string, texto: string | null, base64: string | null) {
  let blob: Blob;
  if (base64) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    blob = new Blob([bytes], { type: mime });
  } else {
    blob = new Blob([texto || ""], { type: mime });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AlertasRelatorios({
  mes,
  df,
  hist,
  alertas,
  medidas,
  historico,
  destPadrao,
  ehStaff,
}: {
  mes: string;
  df: Classificacao[];
  hist: Classificacao[];
  alertas: Alerta[];
  medidas: MedidaHistorico[];
  historico: {
    created_at: string;
    mes_referencia: string | null;
    destinatario: string;
    assunto: string;
    status: string;
    erro: string | null;
  }[];
  destPadrao: string;
  ehStaff: boolean;
}) {
  const nomes = [...new Set(df.map((r) => r.correspondente))].sort();
  const [alvo, setAlvo] = useState(nomes.length === 1 ? nomes[0] : "Todos");
  const [dest, setDest] = useState(destPadrao || "maria.morais@senff.com.br");
  const [formato, setFormato] = useState<"html" | "md" | "pdf">("html");
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, start] = useTransition();
  const recorte = alvo === "Todos" ? df : df.filter((r) => r.correspondente === alvo);
  const dados = useMemo(
    () =>
      montarDadosRelatorio({
        mes,
        linhas: recorte,
        correspondente: alvo === "Todos" ? null : alvo,
        hist,
        alertas,
        medidas,
      }),
    [mes, recorte, alvo, hist, alertas, medidas],
  );
  const previa = useMemo(() => relatorioHtml(dados), [dados]);
  const nC = alertas.filter((a) => a.severidade === "critico").length;
  const nA = alertas.filter((a) => a.severidade === "atencao").length;
  const nI = alertas.filter((a) => a.severidade === "info").length;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Relatoria</h2>
      <div className="rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-4 text-sm">
        <p className="font-semibold text-[var(--senff-navy)]">Critério de severidade</p>
        <p className="mt-1 text-[var(--senff-navy-text)]">
          A coluna Severidade não é uma nota. Cada linha nasce de uma regra do Quadro 5 /
          FEBRABAN (arts. 9º e 51). Mensagens abaixo são para o analista interno; o relatório
          mensal não as reproduz.
        </p>
        <Tabela
          colunas={[
            { chave: "nivel", titulo: "Nível" },
            { chave: "regra", titulo: "Regra" },
            { chave: "metrica", titulo: "Métrica" },
          ]}
          linhas={CRITERIOS_SEVERIDADE.map((c) => ({
            nivel: c.nivel,
            regra: c.regra,
            metrica: c.metrica,
          }))}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Críticos" value={nC} />
        <Stat label="Atenção" value={nA} />
        <Stat label="Informativos" value={nI} />
      </div>
      <Tabela
        colunas={[
          { chave: "sev", titulo: "Severidade" },
          { chave: "c", titulo: "Correspondente" },
          { chave: "t", titulo: "Tipo" },
          { chave: "m", titulo: "Mensagem" },
        ]}
        linhas={alertas.map((a) => ({
          sev: ROTULOS_SEV[a.severidade] || a.severidade,
          c: a.correspondente,
          t: a.tipo,
          m: a.mensagem,
        }))}
      />
      <h2 className="text-xl font-semibold">Relatório mensal</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          Escopo do relatório
          <select
            className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
            value={alvo}
            onChange={(e) => setAlvo(e.target.value)}
          >
            {nomes.length > 1 ? <option value="Todos">Todos</option> : null}
            {nomes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Destinatário (registro automático)
          <input
            className="mt-1 w-full rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
            value={dest}
            onChange={(e) => setDest(e.target.value)}
          />
        </label>
      </div>
      <fieldset className="text-sm">
        <legend className="mb-2 font-medium">Formato do arquivo</legend>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["html", "HTML"],
              ["md", "Markdown (.md)"],
              ["pdf", "PDF"],
            ] as const
          ).map(([id, rotulo]) => (
            <label
              key={id}
              className={`cursor-pointer rounded-[var(--radius-form)] border px-3 py-2 ${
                formato === id
                  ? "border-[var(--senff-acqua)] bg-[#e8f7fb] font-semibold"
                  : "border-[var(--border)] bg-white"
              }`}
            >
              <input
                type="radio"
                name="formato"
                className="mr-2 accent-[var(--senff-acqua)]"
                checked={formato === id}
                onChange={() => setFormato(id)}
              />
              {rotulo}
            </label>
          ))}
        </div>
      </fieldset>
      <button
        className="btn-primary"
        type="button"
        disabled={pendente}
        onClick={() => {
          start(async () => {
            const fd = new FormData();
            fd.set("mes", mes);
            fd.set("destinatario", dest);
            fd.set("correspondente", alvo === "Todos" ? "" : alvo);
            fd.set("formato", formato);
            const r = await gerarERegistrarRelatorio(fd);
            if (!r.ok) {
              setMsg(r.erro);
              return;
            }
            baixarArquivo(r.filename, r.mime, r.texto, r.base64);
            setMsg(
              r.registrado
                ? "Relatório gerado. Envio registrado automaticamente."
                : "Relatório gerado.",
            );
          });
        }}
      >
        {pendente ? "Gerando…" : "Gerar relatório"}
      </button>
      {msg ? <p className="text-sm">{msg}</p> : null}
      <div className="overflow-hidden rounded-[var(--radius-box)] border border-[var(--border)] bg-white">
        <p className="border-b border-[var(--border)] px-3 py-2 text-sm font-medium">
          Prévia no padrão do relatório
        </p>
        <iframe
          title="Prévia do relatório mensal"
          className="h-[min(80vh,900px)] w-full bg-white"
          srcDoc={previa}
        />
      </div>
      {ehStaff ? (
        <>
          <h2 className="text-xl font-semibold">Histórico de envios</h2>
          {historico.length ? (
            <Tabela
              colunas={[
                { chave: "quando", titulo: "Quando" },
                { chave: "mes", titulo: "Mês" },
                { chave: "para", titulo: "Para" },
                { chave: "assunto", titulo: "Assunto" },
                { chave: "status", titulo: "Status" },
                { chave: "erro", titulo: "Erro" },
              ]}
              linhas={historico.map((h) => ({
                quando: (h.created_at || "").slice(0, 19).replace("T", " "),
                mes: (h.mes_referencia || "").slice(0, 7),
                para: h.destinatario,
                assunto: h.assunto,
                status: h.status,
                erro: h.erro || "—",
              }))}
            />
          ) : (
            <p className="text-sm">Nenhum relatório registrado ainda.</p>
          )}
        </>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-3">
      <div className="text-xs uppercase text-[var(--senff-grey)]">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
