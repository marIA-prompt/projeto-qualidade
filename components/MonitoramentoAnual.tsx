"use client";

import { useMemo, useState, useTransition } from "react";
import { gerarERegistrarRelatorioAnual, marcarDesvioGrave } from "@/app/actions";
import { Tabela } from "@/components/ui";
import type { ClassificacaoAnual } from "@/lib/anual";
import { ROTULOS_SEV } from "@/lib/format";
import {
  DESVIOS_GRAVES,
  FAIXAS_ANUAL,
  MEDIDAS_CICLO_ANUAL,
  STATUS_ANUAL_LABELS,
} from "@/lib/motorAnual";
import {
  montarDadosRelatorioAnual,
  relatorioHtmlAnual,
} from "@/lib/relatorioAnual";
import type { MedidaHistorico } from "@/lib/relatorioModelo";

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

export function MonitoramentoAnual({
  ano,
  anos,
  linhas,
  alertas,
  medidas,
  historico,
  destPadrao,
  ehStaff,
}: {
  ano: number;
  anos: number[];
  linhas: ClassificacaoAnual[];
  alertas: { correspondente: string; tipo: string; severidade: string; mensagem: string }[];
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
  const nomes = [...new Set(linhas.map((r) => r.correspondente))].sort();
  const [alvo, setAlvo] = useState(nomes.length === 1 ? nomes[0] : "Todos");
  const [dest, setDest] = useState(destPadrao || "maria.morais@senff.com.br");
  const [formato, setFormato] = useState<"html" | "md" | "pdf">("html");
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, start] = useTransition();
  const recorte = alvo === "Todos" ? linhas : linhas.filter((r) => r.correspondente === alvo);
  const dados = useMemo(
    () =>
      montarDadosRelatorioAnual({
        ano,
        linhas: recorte,
        correspondente: alvo === "Todos" ? null : alvo,
        medidas: medidas as MedidaHistorico[],
      }),
    [ano, recorte, alvo, medidas],
  );
  const previa = useMemo(() => relatorioHtmlAnual(dados), [dados]);
  const nC = alertas.filter((a) => a.severidade === "critico").length;
  const nA = alertas.filter((a) => a.severidade === "atencao").length;
  const nI = alertas.filter((a) => a.severidade === "info").length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold">Monitoramento anual</h2>
        {anos.length > 1 ? (
          <label className="text-sm">
            Ano
            <select
              className="ml-2 rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
              value={ano}
              onChange={(e) => {
                const p = new URLSearchParams(window.location.search);
                p.set("ano", e.target.value);
                window.location.search = p.toString();
              }}
            >
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-[var(--senff-grey)]">Ciclo {ano}</p>
        )}
      </div>
      <div className="rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-4 text-sm">
        <p className="font-semibold text-[var(--senff-navy)]">Pontuação e qualificação (Quadro 3)</p>
        <p className="mt-1 text-[var(--senff-navy-text)]">
          Diferente do fechamento mensal (índice 0,03%). A pontuação geral é a média das
          componentes disponíveis no ano — operacional (ocorrências sem procedência Corban) e
          qualitativa (auditorias) — sem inventar zero. Desvio de conduta grave impede Conforme e
          Parcialmente conforme. Medidas do ciclo anual: advertência → suspensão de 10 dias →
          suspensão definitiva.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {[false, true].map((grave) => (
            <div key={String(grave)} className="overflow-hidden rounded-[var(--radius-box)] border">
              <p className="bg-[#1e8449] px-3 py-2 text-center text-xs font-bold uppercase text-white">
                {grave ? "Com desvio de conduta grave" : "Sem desvio de conduta grave"}
              </p>
              <Tabela
                colunas={[
                  { chave: "faixa", titulo: "Resultado" },
                  { chave: "cls", titulo: "Classificação" },
                ]}
                linhas={FAIXAS_ANUAL.map((f) => ({
                  faixa: f.rotulo,
                  cls: STATUS_ANUAL_LABELS[grave ? f.com : f.sem],
                }))}
              />
            </div>
          ))}
        </div>
        <p className="mt-3 font-medium">Desvios de conduta grave</p>
        <ul className="list-disc pl-5 text-[var(--senff-navy-text)]">
          {DESVIOS_GRAVES.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="mt-2 text-[var(--senff-navy-text)]">
          Ciclo de medidas: {MEDIDAS_CICLO_ANUAL.map((m) => `${m.consecutivo}ª ${m.rotulo}`).join(" → ")}.
          Parcialmente conforme ou Conforme zeram o ciclo. Após 3 anos sem avaliação, índices e
          medidas deixam de ser considerados.
        </p>
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
      <h2 className="text-xl font-semibold">Correspondentes no ciclo {ano}</h2>
      <Tabela
        colunas={[
          { chave: "c", titulo: "Correspondente" },
          { chave: "p", titulo: "Pontuação" },
          { chave: "op", titulo: "Operacional" },
          { chave: "q", titulo: "Auditoria" },
          { chave: "g", titulo: "Desvio grave" },
          { chave: "s", titulo: "Status" },
          { chave: "med", titulo: "Medida sugerida" },
        ]}
        linhas={recorte.map((r) => ({
          c: r.correspondente,
          p: r.pontuacao_geral == null ? "—" : `${r.pontuacao_geral.toFixed(1)}%`,
          op: r.pontuacao_operacional == null ? "—" : `${r.pontuacao_operacional.toFixed(1)}%`,
          q: r.pontuacao_qualitativa == null ? "—" : `${r.pontuacao_qualitativa.toFixed(1)}%`,
          g: r.desvio_conduta_grave ? "Sim" : "Não",
          s: STATUS_ANUAL_LABELS[r.status],
          med: r.medida_sugerida || "—",
        }))}
      />
      {ehStaff ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-4 text-sm"
          action={(fd) => {
            start(async () => {
              const r = await marcarDesvioGrave(fd);
              setMsg(r.ok ? "Desvio de conduta grave atualizado. Recarregue a página." : r.erro);
              if (r.ok) window.location.reload();
            });
          }}
        >
          <p className="w-full font-medium">Registrar desvio de conduta grave (ciclo {ano})</p>
          <label>
            Correspondente
            <select name="correspondente_id" className="mt-1 block rounded-[var(--radius-form)] border px-3 py-2" required>
              {linhas.map((r) => (
                <option key={r.correspondente_id} value={r.correspondente_id}>
                  {r.correspondente}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="ano" value={ano} />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="desvio" value="1" />
            Há desvio de conduta grave
          </label>
          <button className="btn-primary" type="submit" disabled={pendente}>
            Gravar
          </button>
        </form>
      ) : null}
      <h2 className="text-xl font-semibold">Relatório anual</h2>
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
                name="formato-anual"
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
            fd.set("ano", String(ano));
            fd.set("destinatario", dest);
            fd.set("correspondente", alvo === "Todos" ? "" : alvo);
            fd.set("formato", formato);
            const r = await gerarERegistrarRelatorioAnual(fd);
            if (!r.ok) {
              setMsg(r.erro);
              return;
            }
            baixarArquivo(r.filename, r.mime, r.texto, r.base64);
            setMsg(r.registrado ? "Relatório gerado. Envio registrado automaticamente." : "Relatório gerado.");
          });
        }}
      >
        {pendente ? "Gerando…" : "Gerar relatório"}
      </button>
      {msg ? <p className="text-sm">{msg}</p> : null}
      <div className="overflow-hidden rounded-[var(--radius-box)] border border-[var(--border)] bg-white">
        <p className="border-b border-[var(--border)] px-3 py-2 text-sm font-medium">
          Prévia no padrão do relatório anual
        </p>
        <iframe title="Prévia do relatório anual" className="h-[min(80vh,900px)] w-full bg-white" srcDoc={previa} />
      </div>
      {ehStaff ? (
        <>
          <h2 className="text-xl font-semibold">Histórico de envios anuais</h2>
          {historico.length ? (
            <Tabela
              colunas={[
                { chave: "quando", titulo: "Quando" },
                { chave: "ano", titulo: "Ano" },
                { chave: "para", titulo: "Para" },
                { chave: "assunto", titulo: "Assunto" },
                { chave: "status", titulo: "Status" },
                { chave: "erro", titulo: "Erro" },
              ]}
              linhas={historico.map((h) => ({
                quando: (h.created_at || "").slice(0, 19).replace("T", " "),
                ano: (h.mes_referencia || "").slice(0, 4),
                para: h.destinatario,
                assunto: h.assunto,
                status: h.status,
                erro: h.erro || "—",
              }))}
            />
          ) : (
            <p className="text-sm">Nenhum relatório anual registrado ainda.</p>
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
