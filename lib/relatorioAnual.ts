import {
  DESVIOS_GRAVES,
  FAIXAS_ANUAL,
  MEDIDAS_CICLO_ANUAL,
  STATUS_ANUAL_LABELS,
  type StatusAnual,
} from "./motorAnual";
import {
  CSS_RELATORIO,
  escapeHtml,
  dataBr,
  type MedidaHistorico,
} from "./relatorioModelo";

export type ClassificacaoAnual = {
  id: string | null;
  correspondente_id: string;
  correspondente: string;
  cnpj: string;
  ano: number;
  pontuacao_geral: number | null;
  pontuacao_operacional: number | null;
  pontuacao_qualitativa: number | null;
  desvio_conduta_grave: boolean;
  status: StatusAnual;
  motivo: string;
  qtd_reclamacoes: number;
  qtd_acoes_judiciais: number;
  numerador: number;
  total_ocorrencias: number;
  medida_sugerida: string | null;
  medida_codigo: string | null;
};

export type DadosRelatorioAnual = {
  correspondente: string;
  cnpj: string;
  ano: number;
  geradoEm: string;
  status: StatusAnual;
  pontuacao: number | null;
  desvioGrave: boolean;
  motivo: string;
  medidaSugerida: string | null;
  kpis: {
    reclamacoes: number;
    acoes: number;
    numerador: number;
    pontuacaoOperacional: number | null;
    pontuacaoQualitativa: number | null;
  };
  linhas: ClassificacaoAnual[];
  medidas: MedidaHistorico[];
};

export function montarDadosRelatorioAnual(args: {
  ano: number;
  linhas: ClassificacaoAnual[];
  correspondente?: string | null;
  medidas?: MedidaHistorico[];
  geradoEm?: string;
}): DadosRelatorioAnual {
  const recorte = args.correspondente
    ? args.linhas.filter((r) => r.correspondente === args.correspondente)
    : args.linhas;
  const um = recorte.length === 1 ? recorte[0] : null;
  const statusRede = (): StatusAnual => {
    if (!recorte.length) return "nao_aplicavel";
    if (recorte.some((r) => r.status === "nao_conforme")) return "nao_conforme";
    if (recorte.some((r) => r.status === "em_atencao")) return "em_atencao";
    if (recorte.some((r) => r.status === "parcialmente_conforme")) return "parcialmente_conforme";
    if (recorte.every((r) => r.status === "nao_aplicavel")) return "nao_aplicavel";
    if (recorte.every((r) => r.status === "conforme")) return "conforme";
    return "em_atencao";
  };
  return {
    correspondente: args.correspondente || um?.correspondente || "Todos os correspondentes",
    cnpj: um?.cnpj || "",
    ano: args.ano,
    geradoEm: args.geradoEm || dataBr(""),
    status: um?.status || statusRede(),
    pontuacao: um?.pontuacao_geral ?? null,
    desvioGrave: um?.desvio_conduta_grave ?? recorte.some((r) => r.desvio_conduta_grave),
    motivo: um?.motivo || "",
    medidaSugerida: um?.medida_sugerida || null,
    kpis: {
      reclamacoes: recorte.reduce((s, r) => s + r.qtd_reclamacoes, 0),
      acoes: recorte.reduce((s, r) => s + r.qtd_acoes_judiciais, 0),
      numerador: recorte.reduce((s, r) => s + r.numerador, 0),
      pontuacaoOperacional: um?.pontuacao_operacional ?? null,
      pontuacaoQualitativa: um?.pontuacao_qualitativa ?? null,
    },
    linhas: recorte,
    medidas: args.medidas || [],
  };
}

export function assuntoRelatorioAnual(dados: DadosRelatorioAnual): string {
  return `[Senff] Relatório anual de qualidade — ${dados.ano} — ${dados.correspondente}`;
}

export function nomeArquivoRelatorioAnual(dados: DadosRelatorioAnual, ext: "html" | "md" | "pdf"): string {
  const slug = dados.correspondente.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `relatorio-anual-${dados.ano}-${slug || "rede"}.${ext}`;
}

export function relatorioMarkdownAnual(dados: DadosRelatorioAnual): string {
  const st = STATUS_ANUAL_LABELS[dados.status];
  const linhas = [
    "# Monitoramento anual dos correspondentes",
    "",
    "Relatório anual · Plano de Qualidade",
    "**Banco Senff** · Autorregulação do Crédito Consignado",
    "",
    `- **Correspondente bancário:** ${dados.correspondente}${dados.cnpj ? ` (CNPJ ${dados.cnpj})` : ""}`,
    `- **Ano de referência:** ${dados.ano}`,
    `- **Status:** ${st}`,
    `- **Pontuação geral:** ${dados.pontuacao == null ? "—" : `${dados.pontuacao.toFixed(2)}%`}`,
    `- **Desvio de conduta grave:** ${dados.desvioGrave ? "Sim" : "Não"}`,
    `- **Gerado em:** ${dados.geradoEm}`,
    "",
    "## Visão geral",
    "",
    `- Reclamações no ano: **${dados.kpis.reclamacoes}**`,
    `- Ações judiciais no ano: **${dados.kpis.acoes}**`,
    `- Numerador Corban (procedentes): **${dados.kpis.numerador}**`,
    `- Pontuação operacional: **${dados.kpis.pontuacaoOperacional == null ? "—" : `${dados.kpis.pontuacaoOperacional.toFixed(2)}%`}**`,
    `- Pontuação qualitativa (auditorias): **${dados.kpis.pontuacaoQualitativa == null ? "—" : `${dados.kpis.pontuacaoQualitativa.toFixed(2)}%`}**`,
    "",
    "## Qualificação (Quadro 3)",
    "",
    dados.motivo || "Sem avaliação no ciclo.",
    "",
  ];
  if (dados.medidaSugerida) {
    linhas.push(`**Medida sugerida (aplicação manual):** ${dados.medidaSugerida}`, "");
  }
  linhas.push("## Correspondentes do ciclo", "", "| Correspondente | Pontuação | Desvio grave | Status | Medida sugerida |", "|---|---:|---|---|---|");
  for (const r of dados.linhas) {
    linhas.push(
      `| ${r.correspondente} | ${r.pontuacao_geral == null ? "—" : `${r.pontuacao_geral.toFixed(1)}%`} | ${r.desvio_conduta_grave ? "Sim" : "Não"} | ${STATUS_ANUAL_LABELS[r.status]} | ${r.medida_sugerida || "—"} |`,
    );
  }
  linhas.push("", "## Medidas administrativas do ciclo anual", "");
  linhas.push("1ª avaliação com medida: Advertência. 2ª consecutiva: Suspensão de 10 dias úteis. 3ª consecutiva: Suspensão definitiva.");
  linhas.push("Parcialmente conforme ou Conforme desconsideram as medidas anteriores. Após 3 anos sem avaliação, índices e medidas deixam de ser considerados.");
  if (dados.medidas.length) {
    linhas.push("");
    for (const m of dados.medidas) {
      linhas.push(`- **${m.data_aplicacao} · ${m.tipo}:** ${m.descricao}`);
    }
  }
  linhas.push("", "## Desvios de conduta grave", "");
  for (const d of DESVIOS_GRAVES) linhas.push(`- ${d}`);
  linhas.push("", "— Plano de Qualidade de Correspondentes · Uso interno · Banco Senff");
  return linhas.join("\n");
}

function tabelaFaixas(comDesvio: boolean): string {
  const titulo = comDesvio ? "COM DESVIO DE CONDUTA GRAVE" : "SEM DESVIO DE CONDUTA GRAVE";
  const rows = FAIXAS_ANUAL.map(
    (f) =>
      `<tr><td>${escapeHtml(f.rotulo)}</td><td>${escapeHtml(STATUS_ANUAL_LABELS[comDesvio ? f.com : f.sem])}</td></tr>`,
  ).join("");
  return `<div class="faixa-card"><div class="faixa-h">${titulo}</div>
    <table><thead><tr><th>Resultado</th><th>Classificação</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function relatorioHtmlAnual(dados: DadosRelatorioAnual): string {
  const st = STATUS_ANUAL_LABELS[dados.status];
  const linhas = dados.linhas
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.correspondente)}</td>
        <td>${r.pontuacao_geral == null ? "—" : `${r.pontuacao_geral.toFixed(1)}%`}</td>
        <td>${r.desvio_conduta_grave ? "Sim" : "Não"}</td>
        <td class="st-${r.status}">${escapeHtml(STATUS_ANUAL_LABELS[r.status])}</td>
        <td>${escapeHtml(r.medida_sugerida || "—")}</td>
      </tr>`,
    )
    .join("");
  const medidas = dados.medidas.length
    ? dados.medidas
        .map((m) => `<p><strong>${escapeHtml(m.data_aplicacao)} · ${escapeHtml(m.tipo)}:</strong> ${escapeHtml(m.descricao)}</p>`)
        .join("")
    : "<p>Nenhuma medida registrada neste ciclo.</p>";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>${escapeHtml(assuntoRelatorioAnual(dados))}</title>
<style>${CSS_RELATORIO}
.faixas { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.faixa-card { border:1px solid #D6DCEC; border-radius:8px; overflow:hidden; }
.faixa-h { background:#1E8449; color:#fff; font-weight:700; font-size:12px; text-align:center; padding:8px; }
.faixa-card table { width:100%; border-collapse:collapse; font-size:13px; }
.faixa-card th { background:#27306B; color:#fff; padding:6px; }
.faixa-card td { padding:6px 8px; border-top:1px solid #EEF1F8; }
.st-parcialmente_conforme { color:#B7791F; }
.st-em_atencao { color:#B7791F; }
.tab { width:100%; border-collapse:collapse; font-size:13px; }
.tab th, .tab td { border-bottom:1px solid #D6DCEC; padding:8px; text-align:left; }
.tab th { background:#EEF1F8; color:#1B2350; }
@media (max-width:720px){ .faixas { grid-template-columns:1fr; } }
</style></head><body><div class="page">
<div class="brand-bar"></div>
<p class="eyebrow">RELATÓRIO ANUAL · PLANO DE QUALIDADE</p>
<h1>Monitoramento anual dos correspondentes</h1>
<p class="sub">Banco Senff · Autorregulação do Crédito Consignado</p>
<div class="meta">
  <div><small>Correspondente bancário</small><strong>${escapeHtml(dados.correspondente)}</strong>${dados.cnpj ? `<span class="subv">CNPJ ${escapeHtml(dados.cnpj)}</span>` : ""}</div>
  <div><small>Ano de referência</small><strong>${dados.ano}</strong></div>
  <div><small>Status</small><strong class="st-${dados.status}">${escapeHtml(st)}</strong></div>
  <div><small>Gerado em</small><strong>${escapeHtml(dados.geradoEm)}</strong></div>
</div>
<h2>Qualificação do ciclo</h2>
<p>O monitoramento anual usa a pontuação geral de conformidade e a existência ou não de desvio de conduta grave. A pontuação é a média das componentes disponíveis no ano (operacional e/ou auditoria), sem preencher lacuna com zero.</p>
<div class="kpis">
  <article class="kpi"><div class="kpi-n">${dados.pontuacao == null ? "—" : `${dados.pontuacao.toFixed(1)}%`}</div><div class="kpi-l">Pontuação geral</div></article>
  <article class="kpi"><div class="kpi-n">${dados.kpis.reclamacoes}</div><div class="kpi-l">Reclamações no ano</div></article>
  <article class="kpi"><div class="kpi-n">${dados.kpis.acoes}</div><div class="kpi-l">Ações judiciais no ano</div></article>
</div>
<div class="kpis dois">
  <article class="kpi"><div class="kpi-n">${dados.kpis.numerador}</div><div class="kpi-l">Procedentes Corban</div></article>
  <article class="kpi"><div class="kpi-n">${dados.desvioGrave ? "Sim" : "Não"}</div><div class="kpi-l">Desvio de conduta grave</div></article>
</div>
<h2>Faixas de classificação</h2>
<div class="faixas">${tabelaFaixas(false)}${tabelaFaixas(true)}</div>
<h2>Correspondentes</h2>
<table class="tab"><thead><tr><th>Correspondente</th><th>Pontuação</th><th>Desvio grave</th><th>Status</th><th>Medida sugerida</th></tr></thead><tbody>${linhas}</tbody></table>
<h2 class="warn">Medidas administrativas — ciclo anual</h2>
<p>1ª avaliação: ${MEDIDAS_CICLO_ANUAL[0].rotulo}. 2ª consecutiva: ${MEDIDAS_CICLO_ANUAL[1].rotulo}. 3ª consecutiva: ${MEDIDAS_CICLO_ANUAL[2].rotulo}. Parcialmente conforme ou Conforme zeram o ciclo.</p>
${dados.medidaSugerida ? `<div class="alerta"><strong>Medida sugerida:</strong> ${escapeHtml(dados.medidaSugerida)} — aplicação sempre manual.</div>` : ""}
${medidas}
<h2>Desvios de conduta grave</h2>
<ul>${DESVIOS_GRAVES.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>
<p class="foot">Plano de Qualidade de Correspondentes · Uso interno · Banco Senff</p>
</div></body></html>`;
}
