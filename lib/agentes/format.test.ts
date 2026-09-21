import assert from "node:assert/strict";
import { test } from "node:test";
import { fmtIndice, mascararCpf, mesChave } from "./format.ts";

test("máscara de CPF não expõe o completo", () => {
  const bruto = "02692682009";
  const m = mascararCpf(bruto);
  assert.equal(m, "***.***.***-09");
  assert.equal(m.includes(bruto), false);
});

test("índice nulo vira travessão", () => {
  assert.equal(fmtIndice(null), "—");
  assert.equal(fmtIndice(0.0075), "0.7500%");
});

test("mês YYYY-MM-DD vira YYYY-MM", () => {
  assert.equal(mesChave("2026-08-01"), "2026-08");
  assert.equal(mesChave("2026-08"), "2026-08");
});
