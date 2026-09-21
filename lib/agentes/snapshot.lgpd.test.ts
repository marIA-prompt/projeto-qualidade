import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";
import { test } from "node:test";

test("snapshot de agentes não traz CPF de cliente", () => {
  const bruto = readFileSync(join(process.cwd(), "dados", "preview", "snapshot.json"), "utf8");
  assert.equal(/cpf_cliente/i.test(bruto), false);
  const snap = JSON.parse(bruto) as {
    ocorrencias: Record<string, unknown>[];
    classificacoes: { cpf_agente_mascarado: string; status: string; carteira_denominador: number | null }[];
  };
  for (const o of snap.ocorrencias) {
    assert.equal("cpf_cliente" in o, false);
    assert.equal("cpf" in o && o.cpf !== o.cpf_agente, false);
  }
  assert.ok(snap.classificacoes.some((c) => c.status === "nao_aplicavel" && c.carteira_denominador == null));
  assert.ok(snap.classificacoes.every((c) => c.cpf_agente_mascarado.startsWith("***")));
});
