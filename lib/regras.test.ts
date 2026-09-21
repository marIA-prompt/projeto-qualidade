import assert from "node:assert/strict";
import { test } from "node:test";
import { classificarMensal, eProcedenteCorban, eEmAndamento, LIMITE_INDICE_QUADRO5 } from "./motor.ts";
import { sufixoConfirmacao } from "./indefinidos.ts";

test("conforme 0,02%", () => {
  const r = classificarMensal({
    reclamacoes_procedentes_corban: 1,
    acoes_judiciais_procedentes_corban: 1,
    total_reclamacoes_mes: 5,
    carteira_produzida: 10_000,
  });
  assert.equal(r.status, "conforme");
  assert.ok(Math.abs((r.indice || 0) - 0.0002) < 1e-9);
});

test("limite exato é não conforme", () => {
  const r = classificarMensal({
    reclamacoes_procedentes_corban: 3,
    acoes_judiciais_procedentes_corban: 0,
    total_reclamacoes_mes: 3,
    carteira_produzida: 10_000,
  });
  assert.ok(Math.abs((r.indice || 0) - LIMITE_INDICE_QUADRO5) < 1e-9);
  assert.equal(r.status, "nao_conforme");
});

test("sem denominador não inventa zero", () => {
  const r = classificarMensal({
    reclamacoes_procedentes_corban: 4,
    acoes_judiciais_procedentes_corban: 1,
    total_reclamacoes_mes: 8,
    carteira_produzida: null,
  });
  assert.equal(r.status, "nao_aplicavel");
  assert.equal(r.indice, null);
});

test("não inventa procedente na confirmação", () => {
  const p = sufixoConfirmacao("Improcedente", "corban", new Date("2026-09-14T00:00:00Z"));
  assert.ok(p.startsWith("Improcedente"));
  assert.equal(eProcedenteCorban("corban", p), false);
});

test("em andamento só sem classificação final", () => {
  assert.equal(eEmAndamento("indefinido", null), true);
  assert.equal(eEmAndamento("indefinido", "em análise"), true);
  assert.equal(eEmAndamento("indefinido", "Improcedente"), false);
  assert.equal(eEmAndamento("indefinido", "Procedente"), false);
  assert.equal(eEmAndamento("corban", "Improcedente - Corban"), false);
});
