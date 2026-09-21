import assert from "node:assert/strict";
import { test } from "node:test";
import { relatorioAgenteHtml } from "./relatorio.ts";

function clf() {
  return {
    cpf_agente: "11144477735",
    cpf_agente_mascarado: "***.***.***-35",
    nome_agente: "Digitador Alfa",
    cnpj_correspondente: "1",
    cnpjs_vinculo: "1",
    nome_correspondente: "LOJA NORTE",
    mes_referencia: "2026-08",
    qtd_reclamacoes_total: 5,
    qtd_reclamacoes_procedentes_corban: 0,
    qtd_reclamacoes_procedentes_senff: 0,
    qtd_reclamacoes_indefinidas: 0,
    qtd_acoes_judiciais_total: 11,
    qtd_acoes_judiciais_procedentes_corban: 0,
    qtd_acoes_judiciais_procedentes_senff: 0,
    qtd_acoes_judiciais_indefinidas: 0,
    qtd_encaminhadas_fraudes: 0,
    tipo_ocorrencia_mais_frequente: "",
    numerador_indice_quadro6: 0,
    carteira_denominador: null,
    indice: null,
    aplicavel: false,
    status: "nao_aplicavel",
    motivo: "sem carteira",
    numerador: 0,
  };
}

test("relatório omite o trilho 104 quando não há registro no CPF", () => {
  const html = relatorioAgenteHtml({
    clf: clf() as never,
    staff: true,
    geradoEm: "17/09/2026",
  });
  assert.equal(html.includes("Trilho fraude"), false);
  assert.equal(html.includes("arquivo 104"), false);
  assert.equal(html.includes("Quadro 6"), true);
});

test("relatório mostra o trilho 104 só se o CPF tiver registro comprovado", () => {
  const html = relatorioAgenteHtml({
    clf: clf() as never,
    fraude: {
      cpf_agente: "11144477735",
      cpf_agente_mascarado: "***.***.***-35",
      participantes_distintos: 1,
      risco: "baixo",
      acao: "monitoramento_1",
      motivo: "1 Participante distinto com registro comprovado",
    } as never,
    staff: true,
    geradoEm: "17/09/2026",
  });
  assert.equal(html.includes("Trilho fraude — arquivo 104"), true);
  assert.equal(html.includes("Monitoramento 1"), true);
});
