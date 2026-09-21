import {
  fmtCpfCompleto,
  fmtIndice,
  mesRotulo,
  ROTULOS_ACAO_104,
  ROTULOS_RISCO,
  ROTULOS_STATUS,
  ROTULOS_SUSPENSAO,
} from "./format.ts";
import type { Classificacao, Fraude104, PontuacaoMcb } from "./snapshot";

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
.st-nao_aplicavel { color: #6B7280; }
h2 {
  margin: 28px 0 12px;
  padding-bottom: 8px;
  font-size: 1.05rem;
  color: #1B2350;
  border-bottom: 3px solid #3D57A0;
}
.kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.kpi {
  background: #EEF1F8;
  border: 1px solid #D6DCEC;
  border-radius: 8px;
  padding: 14px 10px;
  text-align: center;
}
.kpi-n { font-size: 1.7rem; font-weight: 700; color: #27306B; }
.kpi-l { font-size: 11px; font-weight: 700; color: #6B7280; margin-top: 4px; }
.box {
  background: #F7F8FC;
  border: 1px solid #D6DCEC;
  border-radius: 8px;
  padding: 18px;
}
.alerta {
  background: #FBF3DF;
  border: 1px solid #E7C878;
  border-radius: 8px;
  padding: 12px 14px;
  color: #8A6410;
  margin-bottom: 10px;
}
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
  .meta, .kpis { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 560px) {
  .meta, .kpis { grid-template-columns: 1fr; }
}
`;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Oculto enquanto não houver CPF no arquivo 104. O menu Fraude 104 permanece. */
function blocoFraude104(fraude?: Fraude104): string {
  if (!fraude) return "";
  return `<h2>Trilho fraude — arquivo 104</h2>
    <div class="kpis">
      <div class="kpi"><div class="kpi-n">${fraude.participantes_distintos}</div><div class="kpi-l">Participantes distintos</div></div>
      <div class="kpi"><div class="kpi-n">${esc(fraude.risco ? ROTULOS_RISCO[fraude.risco] || fraude.risco : "—")}</div><div class="kpi-l">Risco</div></div>
      <div class="kpi"><div class="kpi-n">${esc(fraude.acao ? ROTULOS_ACAO_104[fraude.acao] || fraude.acao : "—")}</div><div class="kpi-l">Ação</div></div>
    </div>
    <p class="box">${esc(fraude.motivo)}</p>`;
}

export function relatorioAgenteHtml(opts: {
  clf: Classificacao;
  mcb?: PontuacaoMcb;
  fraude?: Fraude104;
  staff: boolean;
  geradoEm: string;
}): string {
  const { clf, mcb, fraude, staff, geradoEm } = opts;
  const cpf = staff ? fmtCpfCompleto(clf.cpf_agente) : clf.cpf_agente_mascarado;
  const status = ROTULOS_STATUS[clf.status] || clf.status;
  const susp = mcb?.suspensao ? ROTULOS_SUSPENSAO[mcb.suspensao] || mcb.suspensao : "Nenhuma";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Relatório do agente · ${esc(clf.nome_agente || cpf)}</title>
  <style>${CSS_RELATORIO}</style>
</head>
<body>
  <article class="page">
    <div class="brand-bar"></div>
    <p class="eyebrow">Relatório mensal · Plano de Qualidade de Agentes de Crédito</p>
    <h1>Desempenho individual do agente</h1>
    <p class="sub">Banco Senff · Autorregulação do Crédito Consignado (FEBRABAN)</p>
    <div class="meta">
      <div><small>Agente de crédito</small><strong>${esc(clf.nome_agente || "—")}</strong><span class="subv">CPF ${esc(cpf)}</span></div>
      <div><small>Correspondente (vínculo)</small><strong>${esc(clf.nome_correspondente || "—")}</strong></div>
      <div><small>Mês de referência</small><strong>${esc(mesRotulo(clf.mes_referencia))}</strong></div>
      <div><small>Status Quadro 6</small><strong class="st-${esc(clf.status)}">${esc(status)}</strong></div>
    </div>
    ${
      clf.carteira_denominador == null
        ? `<div class="alerta">Carteira produzida pelo agente desde jan/2023 não foi carregada. O índice não foi calculado e o status é Não aplicável — o denominador não foi inventado.</div>`
        : ""
    }
    <h2>Quadro 6 — monitoramento mensal</h2>
    <div class="kpis">
      <div class="kpi"><div class="kpi-n">${clf.qtd_reclamacoes_total}</div><div class="kpi-l">Reclamações no mês</div></div>
      <div class="kpi"><div class="kpi-n">${clf.qtd_acoes_judiciais_total}</div><div class="kpi-l">Ações judiciais</div></div>
      <div class="kpi"><div class="kpi-n">${clf.numerador}</div><div class="kpi-l">Numerador (procedentes)</div></div>
      <div class="kpi"><div class="kpi-n">${clf.carteira_denominador ?? "—"}</div><div class="kpi-l">Carteira desde jan/2023</div></div>
      <div class="kpi"><div class="kpi-n">${esc(fmtIndice(clf.indice))}</div><div class="kpi-l">Índice (teto 0,75%)</div></div>
      <div class="kpi"><div class="kpi-n">${clf.qtd_reclamacoes_indefinidas + clf.qtd_acoes_judiciais_indefinidas}</div><div class="kpi-l">Indefinidas (fora do numerador)</div></div>
    </div>
    <p class="box">${esc(clf.motivo)}</p>
    <h2>Pontuação MCB (art. 12 §1º–§7º)</h2>
    <div class="kpis">
      <div class="kpi"><div class="kpi-n">${mcb?.pontos_vigentes ?? 0}</div><div class="kpi-l">Pontos vigentes (5 por NC)</div></div>
      <div class="kpi"><div class="kpi-n">20 / 12</div><div class="kpi-l">Limiar / janela em meses</div></div>
      <div class="kpi"><div class="kpi-n">${esc(susp)}</div><div class="kpi-l">Suspensão</div></div>
    </div>
    <p class="box">${esc(mcb?.motivo || "Sem pontuação MCB — não houve mês Não conforme.")}</p>
    ${blocoFraude104(fraude)}
    <p class="foot">Gerado em ${esc(geradoEm)} · Banco Senff · consulta prevista no art. 12 §7º. Classificação determinística; nenhuma regra regulatória é decidida por IA.</p>
  </article>
</body>
</html>`;
}
