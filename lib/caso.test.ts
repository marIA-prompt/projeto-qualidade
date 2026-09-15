import assert from "node:assert/strict";
import { test } from "node:test";
import type { Classificacao } from "./types.ts";
import {
  historicoDoCorrespondente,
  textoDescritivo,
  textoStatusQuadro5,
} from "./caso.ts";

function linha(parcial: Partial<Classificacao> & Pick<Classificacao, "correspondente_id" | "mes_referencia">): Classificacao {
  return {
    id: parcial.id || "x",
    correspondente: parcial.correspondente || "AGUIAR (S)",
    cnpj: parcial.cnpj || "11781673000142",
    qtd_reclamacoes: parcial.qtd_reclamacoes ?? 1,
    qtd_reclamacoes_corban: parcial.qtd_reclamacoes_corban ?? 0,
    qtd_reclamacoes_senff: parcial.qtd_reclamacoes_senff ?? 0,
    qtd_acoes_judiciais: parcial.qtd_acoes_judiciais ?? 1,
    qtd_acoes_judiciais_corban: parcial.qtd_acoes_judiciais_corban ?? 0,
    qtd_acoes_judiciais_senff: parcial.qtd_acoes_judiciais_senff ?? 0,
    qtd_indefinidas: parcial.qtd_indefinidas ?? 0,
    canal_mais_frequente: parcial.canal_mais_frequente ?? null,
    numerador: parcial.numerador ?? 0,
    carteira_denominador: parcial.carteira_denominador ?? null,
    indice: parcial.indice ?? null,
    status: parcial.status || "nao_aplicavel",
    aplicavel: parcial.aplicavel ?? false,
    ...parcial,
  };
}

test("descritivo de não aplicável não fala em inventar zero", () => {
  const t = textoDescritivo(
    linha({ correspondente_id: "a", mes_referencia: "2026-08-01", status: "nao_aplicavel" }),
  );
  assert.match(t, /AGUIAR \(S\)/);
  assert.match(t, /não é calculado/);
  assert.equal(t.includes("inventamos"), false);
  assert.equal(t.includes("zero"), false);
});

test("status do quadro 5", () => {
  assert.match(textoStatusQuadro5("conforme"), /Conforme/);
  assert.match(textoStatusQuadro5("nao_conforme"), /Não conforme/);
});

test("histórico recorta e ordena do mês mais recente", () => {
  const hist = historicoDoCorrespondente(
    [
      linha({ correspondente_id: "a", mes_referencia: "2026-07-01" }),
      linha({ correspondente_id: "b", mes_referencia: "2026-08-01" }),
      linha({ correspondente_id: "a", mes_referencia: "2026-08-01" }),
    ],
    "a",
  );
  assert.equal(hist.length, 2);
  assert.equal(hist[0].mes_referencia, "2026-08-01");
  assert.equal(hist[1].mes_referencia, "2026-07-01");
});
