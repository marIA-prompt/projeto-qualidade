import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anosDisponiveis,
  classificarAnual,
  medidaSugeridaAnual,
  pontuacaoGeral,
  pontuacaoOperacional,
} from "./motorAnual.ts";

test("sem ocorrência não inventa pontuação operacional", () => {
  assert.equal(pontuacaoOperacional(0, 0), null);
});

test("operacional 1 procedente Corban em 10 ocorrências é 90%", () => {
  assert.equal(pontuacaoOperacional(1, 10), 90);
});

test("média ignora componente ausente", () => {
  assert.equal(pontuacaoGeral([90, null]), 90);
  assert.equal(pontuacaoGeral([null, null]), null);
});

test("≥ 90% sem desvio grave é conforme", () => {
  const r = classificarAnual({ pontuacaoGeral: 90, desvioCondutaGrave: false });
  assert.equal(r.status, "conforme");
  assert.equal(r.aplicavel, true);
});

test("≥ 90% com desvio grave cai para em atenção", () => {
  const r = classificarAnual({ pontuacaoGeral: 95, desvioCondutaGrave: true });
  assert.equal(r.status, "em_atencao");
});

test("75% a 89% sem desvio é parcialmente conforme", () => {
  assert.equal(classificarAnual({ pontuacaoGeral: 75 }).status, "parcialmente_conforme");
  assert.equal(classificarAnual({ pontuacaoGeral: 89.9 }).status, "parcialmente_conforme");
});

test("com desvio grave 75–89% vira em atenção", () => {
  assert.equal(classificarAnual({ pontuacaoGeral: 80, desvioCondutaGrave: true }).status, "em_atencao");
});

test("< 45% é não conforme com ou sem desvio", () => {
  assert.equal(classificarAnual({ pontuacaoGeral: 44.9 }).status, "nao_conforme");
  assert.equal(classificarAnual({ pontuacaoGeral: 10, desvioCondutaGrave: true }).status, "nao_conforme");
});

test("sem pontuação não aplica o Quadro 3", () => {
  const r = classificarAnual({ pontuacaoGeral: null });
  assert.equal(r.status, "nao_aplicavel");
  assert.equal(r.pontuacao, null);
});

test("ciclo de medidas: 1ª advertência, 2ª suspensão 10 dias, 3ª definitiva", () => {
  assert.equal(medidaSugeridaAnual("conforme", []), null);
  assert.equal(medidaSugeridaAnual("nao_conforme", [])?.codigo, "advertencia");
  assert.equal(medidaSugeridaAnual("em_atencao", ["nao_conforme"])?.codigo, "suspensao_10_dias");
  assert.equal(
    medidaSugeridaAnual("nao_conforme", ["conforme", "em_atencao"])?.codigo,
    "suspensao_10_dias",
  );
  assert.equal(
    medidaSugeridaAnual("nao_conforme", ["em_atencao", "nao_conforme"])?.codigo,
    "suspensao_definitiva",
  );
});

test("parcialmente conforme ou conforme zera o ciclo", () => {
  assert.equal(medidaSugeridaAnual("parcialmente_conforme", ["nao_conforme"]), null);
  assert.equal(medidaSugeridaAnual("conforme", ["em_atencao"]), null);
});

test("anos disponíveis em ordem decrescente", () => {
  assert.deepEqual(anosDisponiveis(["2026-08-01", "2026-03-01", "2025-12-01"]), [2026, 2025]);
});
