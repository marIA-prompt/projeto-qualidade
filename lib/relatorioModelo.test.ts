import assert from "node:assert/strict";
import { test } from "node:test";
import type { Classificacao } from "./types.ts";
import {
  mesPorExtenso,
  montarDadosRelatorio,
  relatorioHtml,
  relatorioMarkdown,
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
