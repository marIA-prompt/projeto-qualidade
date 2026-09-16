import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Classificacao } from "./types.ts";
import {
  mesPorExtenso,
  montarDadosRelatorio,
  relatorioHtml,
  relatorioMarkdown,
  textoPdfSeguro,
} from "./relatorioModelo.ts";

function linha(p: Partial<Classificacao> & Pick<Classificacao, "correspondente" | "mes_referencia">): Classificacao {
  return {
    id: p.id || "1",
    correspondente_id: p.correspondente_id || "cid",
    cnpj: p.cnpj || "12.345.678/0001-90",
    qtd_reclamacoes: p.qtd_reclamacoes ?? 41,
    qtd_reclamacoes_corban: p.qtd_reclamacoes_corban ?? 1,
    qtd_reclamacoes_senff: p.qtd_reclamacoes_senff ?? 0,
    qtd_acoes_judiciais: p.qtd_acoes_judiciais ?? 20,
    qtd_acoes_judiciais_corban: p.qtd_acoes_judiciais_corban ?? 6,
    qtd_acoes_judiciais_senff: p.qtd_acoes_judiciais_senff ?? 0,
    qtd_indefinidas: p.qtd_indefinidas ?? 16,
    canal_mais_frequente: p.canal_mais_frequente ?? "Procon",
    numerador: p.numerador ?? 7,
    carteira_denominador: p.carteira_denominador ?? null,
    indice: p.indice ?? null,
    status: p.status || "nao_aplicavel",
    aplicavel: p.aplicavel ?? false,
    ...p,
  };
}

test("mês por extenso no padrão do modelo", () => {
  assert.equal(mesPorExtenso("2026-08-01"), "Agosto / 2026");
});

test("dados do relatório batem o exemplo CONECT", () => {
  const dados = montarDadosRelatorio({
    mes: "2026-08-01",
    linhas: [linha({ correspondente: "CONECT", mes_referencia: "2026-08-01" })],
    correspondente: "CONECT",
    geradoEm: "15/09/2026",
  });
  assert.equal(dados.correspondente, "CONECT");
  assert.equal(dados.cnpj, "12.345.678/0001-90");
  assert.equal(dados.mesReferencia, "Agosto / 2026");
  assert.equal(dados.status, "nao_aplicavel");
  assert.equal(dados.kpis.reclamacoes.valor, 41);
  assert.equal(dados.kpis.reclamacoes.nota, "1 procedente · Corban");
  assert.equal(dados.kpis.acoesJudiciais.valor, 20);
  assert.equal(dados.kpis.acoesJudiciais.nota, "6 procedentes · Corban");
  assert.equal(dados.kpis.emAnalise.valor, 16);
  assert.equal(dados.kpis.naoConformes.valor, 0);
  assert.equal(dados.kpis.naoAplicaveis.valor, 1);
  assert.equal(dados.evolucao.disponivel, false);
  assert.equal(dados.relacionamento.usarPadrao, true);
});

test("HTML e Markdown seguem as seções do modelo", () => {
  const dados = montarDadosRelatorio({
    mes: "2026-08-01",
    linhas: [linha({ correspondente: "CONECT", mes_referencia: "2026-08-01" })],
    correspondente: "CONECT",
    geradoEm: "15/09/2026",
  });
  const html = relatorioHtml(dados);
  const md = relatorioMarkdown(dados);
  for (const bloco of [
    "Acompanhamento da Qualidade dos Correspondentes",
    "Visão geral dos indicadores",
    "Evolução ao longo dos meses",
    "Alerta de penalidades",
    "Relacionamento",
    "Não Me Perturbe",
  ]) {
    assert.ok(html.includes(bloco), bloco);
    assert.ok(md.includes(bloco), bloco);
  }
  assert.ok(html.includes("viewport"));
  assert.ok(html.includes("@media (max-width"));
  assert.equal(html.includes("inventamos"), false);
});

test("evolução fica disponível no segundo mês", () => {
  const dados = montarDadosRelatorio({
    mes: "2026-08-01",
    linhas: [linha({ correspondente: "CONECT", mes_referencia: "2026-08-01" })],
    correspondente: "CONECT",
    hist: [
      linha({ correspondente: "CONECT", mes_referencia: "2026-07-01", qtd_reclamacoes: 10 }),
      linha({ correspondente: "CONECT", mes_referencia: "2026-08-01" }),
    ],
    geradoEm: "15/09/2026",
  });
  assert.equal(dados.evolucao.disponivel, true);
  assert.equal(dados.evolucao.pontos.length, 2);
  assert.ok(relatorioHtml(dados).includes("evo-chart"));
});

test("texto do PDF troca ≥ e mantém acentos latin-1", () => {
  const t = textoPdfSeguro("CONECT teve 41 reclamações (corte ≥ 3) no canal ‘Procon’.");
  assert.equal(t.includes("≥"), false);
  assert.match(t, />= 3/);
  assert.match(t, /reclamações/);
  assert.match(t, /'Procon'/);
  assert.equal(/[^\u0020-\u007e\u00a0-\u00ff]/.test(t), false);
});

test("Helvetica rejeita ≥ cru e aceita o texto sanitizado", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage();
  const bruto = "CONECT teve 41 reclamações no mês (corte de aplicabilidade ≥ 3).";
  assert.throws(() => page.drawText(bruto, { x: 10, y: 100, size: 10, font }));
  page.drawText(textoPdfSeguro(bruto), { x: 10, y: 80, size: 10, font });
  const bytes = await doc.save();
  assert.ok(bytes.byteLength > 500);
});

