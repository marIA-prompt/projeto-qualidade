import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHAVE_ACOMPANHAMENTO_FILA,
  barrasCanal,
  chaveAcompanhamentoConversa,
  chaveAcompanhamentoValida,
  correspondentesDoHistorico,
  corbanValido,
  filtrarCorban,
  queryPainel,
  serieRede,
  topOcorrencias,
} from "./filtros.ts";

test("query do painel preserva mês e correspondente", () => {
  assert.equal(queryPainel({ mes: "2026-08-01", corban: "abc" }), "?mes=2026-08-01&corban=abc");
  assert.equal(queryPainel({ mes: "2026-08-01" }), "?mes=2026-08-01");
  assert.equal(queryPainel({}), "");
});

test("lista de correspondentes é única e ordenada", () => {
  const opcoes = correspondentesDoHistorico([
    { correspondente_id: "2", correspondente: "UNICA" },
    { correspondente_id: "1", correspondente: "CONECT" },
    { correspondente_id: "2", correspondente: "UNICA" },
  ]);
  assert.deepEqual(opcoes, [
    { id: "1", nome: "CONECT" },
    { id: "2", nome: "UNICA" },
  ]);
  assert.equal(corbanValido("1", opcoes), "1");
  assert.equal(corbanValido("x", opcoes), null);
});

test("filtro de correspondente recorta a visão", () => {
  const linhas = [
    { correspondente_id: "a", n: 1 },
    { correspondente_id: "b", n: 2 },
  ];
  assert.equal(filtrarCorban(linhas, null).length, 2);
  assert.deepEqual(filtrarCorban(linhas, "b"), [{ correspondente_id: "b", n: 2 }]);
});

test("top ocorrências limita barras para o gráfico caber", () => {
  const linhas = Array.from({ length: 12 }, (_, i) => ({
    correspondente: `C${i}`,
    qtd_reclamacoes: 12 - i,
    qtd_acoes_judiciais: 0,
  }));
  const top = topOcorrencias(linhas, 10);
  assert.equal(top.length, 10);
  assert.equal(top[0].nome, "C0");
  assert.equal(top[0].Reclamações, 12);
});

test("barras de canal respeitam mês e correspondente", () => {
  const recs = [
    { canal_origem: "Procon", mes_referencia: "2026-08-01", correspondente_id: "a" },
    { canal_origem: "Procon", mes_referencia: "2026-08-01", correspondente_id: "a" },
    { canal_origem: "Bacen", mes_referencia: "2026-08-01", correspondente_id: "b" },
    { canal_origem: "Procon", mes_referencia: "2026-07-01", correspondente_id: "a" },
  ];
  const todos = barrasCanal(recs, { mes: "2026-08-01" });
  assert.deepEqual(todos, [
    { nome: "Procon", Reclamações: 2 },
    { nome: "Bacen", Reclamações: 1 },
  ]);
  const um = barrasCanal(recs, { mes: "2026-08-01", corban: "b" });
  assert.deepEqual(um, [{ nome: "Bacen", Reclamações: 1 }]);
});

test("série agrega rede e índice médio em %", () => {
  const serie = serieRede([
    {
      mes_referencia: "2026-08-01",
      qtd_reclamacoes: 2,
      qtd_acoes_judiciais: 1,
      numerador: 1,
      status: "nao_conforme",
      indice: 0.0004,
    },
    {
      mes_referencia: "2026-08-01",
      qtd_reclamacoes: 3,
      qtd_acoes_judiciais: 0,
      numerador: 0,
      status: "conforme",
      indice: 0.0002,
    },
  ]);
  assert.equal(serie.length, 1);
  assert.equal(serie[0].Reclamações, 5);
  assert.equal(serie[0]["Não conformes"], 1);
  assert.equal(serie[0]["Índice (%)"], 0.03);
});

test("chave de acompanhamento da conversa e da fila", () => {
  assert.equal(chaveAcompanhamentoConversa("volume_reclamacoes"), "conversa:volume_reclamacoes");
  assert.equal(chaveAcompanhamentoValida(CHAVE_ACOMPANHAMENTO_FILA), true);
  assert.equal(chaveAcompanhamentoValida("conversa:relacionamento"), true);
  assert.equal(chaveAcompanhamentoValida("outra"), false);
});
