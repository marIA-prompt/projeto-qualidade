import type { Alerta } from "./alertas";
import type { Classificacao } from "./types";

export type StatusRelatorio = "conforme" | "nao_conforme" | "parcial" | "nao_aplicavel";

export type KpiRelatorio = { valor: number; nota?: string };

export type PontoEvolucao = {
  mes: string;
  reclamacoes: number;
  acoesJudiciais: number;
  numerador: number;
};

export type PenalidadeRegistro = { data: string; tipo: string; descricao: string };

export type AlertaEspecifico = { titulo: string; texto: string };

export type MedidaHistorico = {
  correspondente_id: string;
  correspondente?: string;
  data_aplicacao: string;
  tipo: string;
  descricao: string;
};

export type DadosRelatorio = {
  correspondente: string;
  cnpj: string;
  mesReferencia: string;
  geradoEm: string;
  status: StatusRelatorio;
  kpis: {
    reclamacoes: KpiRelatorio;
    acoesJudiciais: KpiRelatorio;
    emAnalise: KpiRelatorio;
    naoConformes: KpiRelatorio;
    naoAplicaveis: KpiRelatorio;
  };
  evolucao: {
    disponivel: boolean;
    pontos: PontoEvolucao[];
  };
  alertaPenalidades: { registros: PenalidadeRegistro[] };
  relacionamento: {
    alertasEspecificos: AlertaEspecifico[];
    usarPadrao: boolean;
  };
};

export const RELACIONAMENTO_PADRAO: [string, string][] = [
  [
    "Não Me Perturbe (NMP)",
    "atenção à realização de contatos e à utilização dos números de telefone permitidos, observando integralmente as regras aplicáveis.",
  ],
  [
    "Oferta de produtos",
    "atenção à clareza das informações apresentadas ao cliente e à oferta adequada ao seu perfil e interesse.",
  ],
  [
    "Atendimento",
    "atenção à qualidade das orientações prestadas e à correta condução das solicitações dos clientes.",
  ],
  [
    "Reclamações",
    "atenção aos motivos das reclamações recorrentes, especialmente quando indicarem possível falha de procedimento ou de atendimento.",
  ],
  [
    "Autorregulação",
    "atenção ao cumprimento das regras e dos procedimentos estabelecidos, evitando reincidências que possam impactar os indicadores de qualidade do correspondente.",
  ],
];

export const STATUS_LABELS: Record<StatusRelatorio, string> = {
  conforme: "Conforme",
  nao_conforme: "Não conforme",
  parcial: "Parcial",
  nao_aplicavel: "Não aplicável",
};

const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const TITULO_ALERTA: Record<string, string> = {
  nao_conforme: "Não conformidade no Quadro 5",
  volume_reclamacoes: "Volume de reclamações",
  relacionamento: "Canal de reclamações",
  indice_atencao: "Índice próximo do teto",
};

export function mesPorExtenso(iso: string): string {
  const t = String(iso || "").slice(0, 10);
  const mes = Number(t.slice(5, 7));
  const ano = t.slice(0, 4);
  if (!mes || mes < 1 || mes > 12 || !ano) return t.slice(0, 7) || "—";
  return `${MESES_PT[mes - 1]} / ${ano}`;
}

export function dataBr(iso: string, agora = new Date()): string {
  const t = String(iso || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return `${t.slice(8, 10)}/${t.slice(5, 7)}/${t.slice(0, 4)}`;
  }
  const d = agora;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function assuntoRelatorio(dados: DadosRelatorio): string {
  return `[Senff] Relatório mensal de qualidade — ${dados.mesReferencia} — ${dados.correspondente}`;
}

function notaProcedente(corban: number, senff: number): string | undefined {
  const bits: string[] = [];
  if (corban > 0) bits.push(`${corban} procedente${corban > 1 ? "s" : ""} · Corban`);
  if (senff > 0) bits.push(`${senff} procedente${senff > 1 ? "s" : ""} · Senff`);
  return bits.length ? bits.join(" · ") : undefined;
}

function statusEscopo(linhas: Classificacao[]): StatusRelatorio {
  if (!linhas.length) return "nao_aplicavel";
  if (linhas.length === 1) {
    const s = linhas[0].status;
    if (s === "conforme" || s === "nao_conforme" || s === "nao_aplicavel") return s;
    return "nao_aplicavel";
  }
  if (linhas.some((r) => r.status === "nao_conforme")) return "nao_conforme";
  if (linhas.every((r) => r.status === "nao_aplicavel")) return "nao_aplicavel";
  if (linhas.some((r) => r.status === "conforme") && linhas.some((r) => r.status !== "conforme")) {
    return "parcial";
  }
  return "conforme";
}

function pontosEvolucao(hist: Classificacao[], correspondente?: string | null): PontoEvolucao[] {
  const recorte = correspondente ? hist.filter((h) => h.correspondente === correspondente) : hist;
  const porMes = new Map<string, PontoEvolucao>();
  for (const h of recorte) {
    const mes = String(h.mes_referencia || "").slice(0, 7);
    const cur = porMes.get(mes) || { mes, reclamacoes: 0, acoesJudiciais: 0, numerador: 0 };
    cur.reclamacoes += h.qtd_reclamacoes;
    cur.acoesJudiciais += h.qtd_acoes_judiciais;
    cur.numerador += h.numerador;
    porMes.set(mes, cur);
  }
  return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

export function montarDadosRelatorio(args: {
  mes: string;
  linhas: Classificacao[];
  correspondente?: string | null;
  hist?: Classificacao[];
  alertas?: Alerta[];
  medidas?: MedidaHistorico[];
  geradoEm?: string;
}): DadosRelatorio {
  const df = args.correspondente
    ? args.linhas.filter((r) => r.correspondente === args.correspondente)
    : args.linhas;
  const um = df.length === 1 ? df[0] : null;
  const rec = df.reduce((s, r) => s + r.qtd_reclamacoes, 0);
  const recC = df.reduce((s, r) => s + r.qtd_reclamacoes_corban, 0);
  const recS = df.reduce((s, r) => s + r.qtd_reclamacoes_senff, 0);
  const aj = df.reduce((s, r) => s + r.qtd_acoes_judiciais, 0);
  const ajC = df.reduce((s, r) => s + r.qtd_acoes_judiciais_corban, 0);
  const ajS = df.reduce((s, r) => s + r.qtd_acoes_judiciais_senff, 0);
  const emAnalise = df.reduce((s, r) => s + r.qtd_indefinidas, 0);
  const naoConformes = df.filter((r) => r.status === "nao_conforme").length;
  const naoAplicaveis = df.filter((r) => r.status === "nao_aplicavel").length;
  const pontos = pontosEvolucao(args.hist || df, args.correspondente);
  const alertasFonte = args.correspondente
    ? (args.alertas || []).filter((a) => a.correspondente === args.correspondente)
    : args.alertas || [];
  const alertasEspecificos = alertasFonte
    .filter((a) => TITULO_ALERTA[a.tipo])
    .map((a) => ({ titulo: TITULO_ALERTA[a.tipo], texto: a.mensagem }));
  const medidasFonte = args.correspondente
    ? (args.medidas || []).filter((m) => {
        const alvo = df[0];
        return (
          m.correspondente === args.correspondente ||
          (alvo && m.correspondente_id === alvo.correspondente_id)
        );
      })
    : args.medidas || [];
  const registros = medidasFonte.map((m) => ({
    data: dataBr(m.data_aplicacao),
    tipo: m.tipo,
    descricao: m.descricao,
  }));

  return {
    correspondente: args.correspondente || um?.correspondente || "Todos os correspondentes",
    cnpj: um?.cnpj || "",
    mesReferencia: mesPorExtenso(args.mes),
    geradoEm: args.geradoEm || dataBr(""),
    status: statusEscopo(df),
    kpis: {
      reclamacoes: { valor: rec, nota: notaProcedente(recC, recS) },
      acoesJudiciais: { valor: aj, nota: notaProcedente(ajC, ajS) },
      emAnalise: { valor: emAnalise, nota: "fora do índice" },
      naoConformes: { valor: naoConformes },
      naoAplicaveis: {
        valor: naoAplicaveis,
        nota: naoAplicaveis > 0 ? "sem carteira / corte" : undefined,
      },
    },
    evolucao: { disponivel: pontos.length >= 2, pontos },
    alertaPenalidades: { registros },
    relacionamento: { alertasEspecificos, usarPadrao: true },
  };
}

export function relatorioMarkdown(dados: DadosRelatorio): string {
  const linhas = [
    "# Acompanhamento da Qualidade dos Correspondentes",
    "",
    "Relatório mensal · Plano de Qualidade",
    "**Banco Senff** · Autorregulação do Crédito Consignado",
    "",
    `- **Correspondente bancário:** ${dados.correspondente}${dados.cnpj ? ` (CNPJ ${dados.cnpj})` : ""}`,
    `- **Mês de referência:** ${dados.mesReferencia}`,
    `- **Status:** ${STATUS_LABELS[dados.status]}`,
    `- **Gerado em:** ${dados.geradoEm}`,
    "",
    "## Visão geral dos indicadores",
    "",
    `- Reclamações: **${dados.kpis.reclamacoes.valor}**${dados.kpis.reclamacoes.nota ? ` (${dados.kpis.reclamacoes.nota})` : ""}`,
    `- Ações judiciais: **${dados.kpis.acoesJudiciais.valor}**${dados.kpis.acoesJudiciais.nota ? ` (${dados.kpis.acoesJudiciais.nota})` : ""}`,
    `- Em análise: **${dados.kpis.emAnalise.valor}** (${dados.kpis.emAnalise.nota})`,
    `- Não conformes: **${dados.kpis.naoConformes.valor}**`,
    `- Não aplicáveis: **${dados.kpis.naoAplicaveis.valor}**${dados.kpis.naoAplicaveis.nota ? ` (${dados.kpis.naoAplicaveis.nota})` : ""}`,
    "",
    "## Evolução ao longo dos meses",
    "",
  ];
  if (dados.evolucao.disponivel && dados.evolucao.pontos.length) {
    linhas.push("| Mês | Reclamações | Ações judiciais | Numerador |", "|---|---:|---:|---:|");
    for (const p of dados.evolucao.pontos) {
      linhas.push(`| ${p.mes} | ${p.reclamacoes} | ${p.acoesJudiciais} | ${p.numerador} |`);
    }
  } else {
    linhas.push(
      "Gráfico de evolução mensal disponível a partir do 2º mês consecutivo de acompanhamento do correspondente.",
    );
  }
  linhas.push("", "## Alerta de penalidades — histórico", "");
  if (dados.alertaPenalidades.registros.length) {
    for (const p of dados.alertaPenalidades.registros) {
      linhas.push(`- **${p.data} · ${p.tipo}:** ${p.descricao}`);
    }
  } else {
    linhas.push(
      "Nenhum registro no período. Histórico consolidado a partir da tela “Medidas administrativas”.",
    );
  }
  linhas.push("", "## Relacionamento", "");
  for (const a of dados.relacionamento.alertasEspecificos) {
    linhas.push(`- **Atenção — ${a.titulo}:** ${a.texto}`);
  }
  if (dados.relacionamento.usarPadrao) {
    linhas.push(
      "",
      "Os resultados reforçam a importância de observar, no dia a dia da operação, as regras aplicáveis à atuação do correspondente. Entre os principais pontos, destacamos:",
      "",
    );
    for (const [label, texto] of RELACIONAMENTO_PADRAO) {
      linhas.push(`- **${label}:** ${texto}`);
    }
  }
  linhas.push("", "— Plano de Qualidade de Correspondentes · Uso interno · Banco Senff");
  return linhas.join("\n");
}

function kpiHtml(valor: number, label: string, nota?: string, accent?: string): string {
  const cor = accent || "#27306B";
  return `<article class="kpi">
    <div class="kpi-n" style="color:${cor}">${escapeHtml(String(valor))}</div>
    <div class="kpi-l">${escapeHtml(label)}</div>
    ${nota ? `<div class="kpi-nota">${escapeHtml(nota)}</div>` : ""}
  </article>`;
}

function chartHtml(pontos: PontoEvolucao[]): string {
  const max = Math.max(1, ...pontos.map((p) => Math.max(p.reclamacoes, p.acoesJudiciais)));
  const cols = pontos
    .map((p) => {
      const hRec = Math.round((p.reclamacoes / max) * 100);
      const hAj = Math.round((p.acoesJudiciais / max) * 100);
      return `<div class="evo-col">
        <div class="evo-bars" aria-hidden="true">
          <div class="evo-bar rec" style="height:${hRec}%"></div>
          <div class="evo-bar aj" style="height:${hAj}%"></div>
        </div>
        <div class="evo-lab">${escapeHtml(p.mes)}</div>
        <div class="evo-n">${p.reclamacoes} rec · ${p.acoesJudiciais} aj</div>
      </div>`;
    })
    .join("");
  return `<div class="evo-chart">${cols}</div>
    <p class="evo-legenda"><span class="dot rec"></span> Reclamações <span class="dot aj"></span> Ações judiciais</p>`;
}

export const CSS_RELATORIO = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Calibri, "Segoe UI", Arial, sans-serif;
  color: #444;
  background: #eef1f8;
}
.page {
  max-width: 900px;
  margin: 0 auto;
  background: #fff;
  padding: 28px 32px 40px;
}
.brand-bar { height: 8px; background: #27306B; margin: -28px -32px 22px; }
.eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: #3D57A0;
}
h1 {
  margin: 0 0 6px;
  font-size: clamp(1.35rem, 3vw, 1.85rem);
  line-height: 1.2;
  color: #1B2350;
}
.sub { margin: 0 0 22px; color: #3D57A0; font-style: italic; }
.meta {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px 20px;
  margin-bottom: 8px;
}
.meta small {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #6B7280;
  margin-bottom: 4px;
}
.meta strong { display: block; color: #1B2350; font-size: 15px; }
.meta .subv { color: #6B7280; font-size: 12px; font-weight: 400; }
.st-conforme { color: #1E8449; }
.st-nao_conforme { color: #C0392B; }
.st-parcial { color: #B7791F; }
.st-nao_aplicavel { color: #6B7280; }
h2 {
  margin: 28px 0 12px;
  padding-bottom: 8px;
  font-size: 1.05rem;
  color: #1B2350;
  border-bottom: 3px solid #3D57A0;
}
h2.warn { border-bottom-color: #E7C878; }
.kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.kpis.dois { grid-template-columns: repeat(2, 1fr); margin-top: 10px; }
.kpi {
  background: #EEF1F8;
  border: 1px solid #D6DCEC;
  border-radius: 8px;
  padding: 14px 10px;
  text-align: center;
}
.kpi-n { font-size: 1.7rem; font-weight: 700; color: #27306B; }
.kpi-l { font-size: 11px; font-weight: 700; color: #6B7280; margin-top: 4px; }
.kpi-nota { font-size: 11px; font-style: italic; color: #6B7280; margin-top: 2px; }
.box {
  background: #F7F8FC;
  border: 1px solid #D6DCEC;
  border-radius: 8px;
  padding: 18px;
}
.box.amber { background: #FBF3DF; border-color: #E7C878; color: #8A6410; }
.placeholder { text-align: center; color: #6B7280; }
.placeholder strong { display: block; color: #1B2350; margin-bottom: 6px; }
.evo-chart {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  min-height: 160px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.evo-col { flex: 1 0 56px; text-align: center; min-width: 56px; }
.evo-bars { display: flex; gap: 4px; align-items: flex-end; height: 120px; justify-content: center; }
.evo-bar { width: 14px; border-radius: 3px 3px 0 0; min-height: 2px; }
.evo-bar.rec { background: #05aaca; }
.evo-bar.aj { background: #112369; }
.evo-lab { font-size: 11px; color: #1B2350; margin-top: 6px; font-weight: 700; }
.evo-n { font-size: 10px; color: #6B7280; }
.evo-legenda { margin: 10px 0 0; font-size: 12px; color: #6B7280; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin: 0 4px 0 10px; }
.dot.rec { background: #05aaca; }
.dot.aj { background: #112369; }
.alerta {
  background: #FBF3DF;
  border: 1px solid #E7C878;
  border-radius: 8px;
  padding: 12px 14px;
  color: #8A6410;
  margin-bottom: 10px;
}
.intro {
  font-weight: 700;
  font-style: italic;
  color: #1B2350;
  margin: 0 0 14px;
}
.callout {
  margin: 0 0 12px;
  padding-left: 14px;
  border-left: 4px solid #3D57A0;
}
.callout b { color: #1B2350; }
.foot {
  margin-top: 28px;
  padding-top: 10px;
  border-top: 1px solid #D9DEEA;
  font-size: 11px;
  color: #6B7280;
}
@media (max-width: 800px) {
  .page { padding: 20px 16px 32px; }
  .brand-bar { margin: -20px -16px 18px; }
  .meta { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 560px) {
  .meta, .kpis, .kpis.dois { grid-template-columns: 1fr; }
}
@media print {
  body { background: #fff; }
  .page { max-width: none; padding: 12mm; box-shadow: none; }
  .brand-bar { margin: -12mm -12mm 10mm; }
}
@page { size: A4; margin: 14mm 16mm; }
`;

export function relatorioHtml(dados: DadosRelatorio): string {
  const st = STATUS_LABELS[dados.status];
  const naoConfAccent = dados.kpis.naoConformes.valor > 0 ? "#C0392B" : "#1E8449";
  const evo = dados.evolucao.disponivel
    ? chartHtml(dados.evolucao.pontos)
    : `<div class="placeholder">
        <strong>Gráfico de evolução mensal</strong>
        Disponível a partir do 2º mês consecutivo de acompanhamento do correspondente.
      </div>`;
  const penal = dados.alertaPenalidades.registros.length
    ? dados.alertaPenalidades.registros
        .map(
          (p) =>
            `<p><strong>${escapeHtml(p.data)} · ${escapeHtml(p.tipo)}:</strong> ${escapeHtml(p.descricao)}</p>`,
        )
        .join("")
    : `<p>Nenhum registro no período. Histórico consolidado a partir da tela “Medidas administrativas”.</p>`;
  const especificos = dados.relacionamento.alertasEspecificos
    .map(
      (a) =>
        `<div class="alerta"><strong>Atenção — ${escapeHtml(a.titulo)}:</strong> ${escapeHtml(a.texto)}</div>`,
    )
    .join("");
  const padrao = dados.relacionamento.usarPadrao
    ? `<p class="intro">Os resultados reforçam a importância de observar, no dia a dia da operação, as regras aplicáveis à atuação do correspondente. Entre os principais pontos, destacamos:</p>
      ${RELACIONAMENTO_PADRAO.map(
        ([l, t]) => `<p class="callout"><b>${escapeHtml(l)}:</b> ${escapeHtml(t)}</p>`,
      ).join("")}`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(assuntoRelatorio(dados))}</title>
  <style>${CSS_RELATORIO}</style>
</head>
<body>
  <article class="page">
    <div class="brand-bar"></div>
    <p class="eyebrow">Relatório mensal · Plano de Qualidade</p>
    <h1>Acompanhamento da Qualidade dos Correspondentes</h1>
    <p class="sub">Banco Senff · Autorregulação do Crédito Consignado</p>
    <div class="meta">
      <div><small>Correspondente bancário</small><strong>${escapeHtml(dados.correspondente)}</strong>${
        dados.cnpj ? `<span class="subv">CNPJ ${escapeHtml(dados.cnpj)}</span>` : ""
      }</div>
      <div><small>Mês de referência</small><strong>${escapeHtml(dados.mesReferencia)}</strong></div>
      <div><small>Status</small><strong class="st-${dados.status}">${escapeHtml(st)}</strong></div>
      <div><small>Gerado em</small><strong>${escapeHtml(dados.geradoEm)}</strong></div>
    </div>
    <h2>Visão geral dos indicadores</h2>
    <div class="kpis">
      ${kpiHtml(dados.kpis.reclamacoes.valor, "Reclamações", dados.kpis.reclamacoes.nota)}
      ${kpiHtml(dados.kpis.acoesJudiciais.valor, "Ações judiciais", dados.kpis.acoesJudiciais.nota)}
      ${kpiHtml(dados.kpis.emAnalise.valor, "Em análise", dados.kpis.emAnalise.nota)}
    </div>
    <div class="kpis dois">
      ${kpiHtml(dados.kpis.naoConformes.valor, "Não conformes", dados.kpis.naoConformes.nota, naoConfAccent)}
      ${kpiHtml(dados.kpis.naoAplicaveis.valor, "Não aplicáveis", dados.kpis.naoAplicaveis.nota)}
    </div>
    <h2>Evolução ao longo dos meses</h2>
    <div class="box">${evo}</div>
    <h2 class="warn">Alerta de penalidades — histórico</h2>
    <div class="box amber">${penal}</div>
    <h2>Relacionamento</h2>
    ${especificos}${padrao}
    <p class="foot">Plano de Qualidade de Correspondentes · Uso interno · Banco Senff</p>
  </article>
</body>
</html>`;
}

export function nomeArquivoRelatorio(dados: DadosRelatorio, ext: "html" | "md" | "pdf"): string {
  const slug = dados.correspondente
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const mes = dados.mesReferencia.replace(/\s+/g, "").replace("/", "-").toLowerCase();
  return `relatorio_qualidade_${slug || "rede"}_${mes}.${ext}`;
}
