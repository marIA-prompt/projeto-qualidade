import assert from "node:assert/strict";
import { test } from "node:test";
import { formatarPontuacao, parsePontuacaoManual, pontuacaoPilar } from "./pilares.ts";

test("média do pilar ignora nao_avaliado", () => {
  assert.equal(pontuacaoPilar({ a: "ok", b: "nao_ok", c: "nao_avaliado" }), 50);
});

test("percentual manual aceita o número do relatório", () => {
  assert.deepEqual(parsePontuacaoManual("92"), { ok: true, valor: 92 });
  assert.deepEqual(parsePontuacaoManual("92%"), { ok: true, valor: 92 });
  assert.deepEqual(parsePontuacaoManual("92,5"), { ok: true, valor: 92.5 });
  assert.deepEqual(parsePontuacaoManual(""), { ok: true, valor: null });
});

test("percentual manual rejeita fora de 0–100", () => {
  assert.equal(parsePontuacaoManual("abc").ok, false);
  assert.equal(parsePontuacaoManual("-1").ok, false);
  assert.equal(parsePontuacaoManual("101").ok, false);
});

test("exibe a pontuação com %", () => {
  assert.equal(formatarPontuacao(92), "92%");
  assert.equal(formatarPontuacao(null), "—");
});
