import assert from "node:assert/strict";
import { test } from "node:test";
import { anosDisponiveis, consolidarAnoAgente } from "./anualAgente.ts";
import { barrasCanal, serieMensal } from "./evolucao.ts";

function clf(parcial: Record<string, unknown>) {
  return {
    cpf_agente_mascarado: "***.***.***-09",
    nome_agente: "Agente Teste",
    cnpj_correspondente: "1",
    cnpjs_vinculo: "1",
    nome_correspondente: "CORBAN",
    qtd_reclamacoes_total: 0,
    qtd_reclamacoes_procedentes_corban: 0,
    qtd_reclamacoes_procedentes_senff: 0,
    qtd_reclamacoes_indefinidas: 0,
    qtd_acoes_judiciais_total: 0,
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
    motivo: "teste",
    numerador: 0,
    ...parcial,
  };
}

test("série mensal soma a rede e isola um CPF", () => {
  const dados = [
    clf({ cpf_agente: "111", mes_referencia: "2026-03", qtd_reclamacoes_total: 2, numerador: 1 }),
    clf({ cpf_agente: "222", mes_referencia: "2026-03", qtd_reclamacoes_total: 3, numerador: 0 }),
    clf({ cpf_agente: "111", mes_referencia: "2026-04", qtd_reclamacoes_total: 1, numerador: 0 }),
  ];
  const rede = serieMensal(dados as never);
  assert.equal(rede.length, 2);
  assert.equal(rede[0].Reclamações, 5);
  const um = serieMensal(dados as never, "111");
  assert.equal(um[0].Reclamações, 2);
  assert.equal(um[1].Reclamações, 1);
});

test("canal ignora ação judicial e duplicata", () => {
  const barras = barrasCanal(
    [
      {
        id: "a",
        tipo_ocorrencia: "4",
        canal_origem: "Procon",
        cpf_agente: "111",
        mes_referencia: "2026-08-01",
        duplicada_unitariedade: false,
        sem_cpf_agente: false,
      } as never,
      {
        id: "b",
        tipo_ocorrencia: "1",
        canal_origem: "Ação judicial",
        cpf_agente: "111",
        mes_referencia: "2026-08-01",
        duplicada_unitariedade: false,
        sem_cpf_agente: false,
      } as never,
    ],
    { mes: "2026-08" },
  );
  assert.deepEqual(barras, [{ nome: "Procon", Reclamações: 1 }]);
});

test("anos disponíveis saem dos meses, do mais recente", () => {
  assert.deepEqual(anosDisponiveis(["2026-08", "2025-12", "2026-03"]), [2026, 2025]);
});

test("consolidado anual não inventa status e soma o Quadro 6", () => {
  const linhas = consolidarAnoAgente(
    [
      clf({
        cpf_agente: "111",
        mes_referencia: "2026-08",
        qtd_reclamacoes_total: 5,
        qtd_acoes_judiciais_total: 11,
        numerador: 8,
        status: "nao_aplicavel",
      }),
      clf({
        cpf_agente: "111",
        mes_referencia: "2026-07",
        qtd_reclamacoes_total: 2,
        numerador: 0,
        status: "nao_aplicavel",
      }),
    ] as never,
    [{ cpf_agente: "111", pontos_vigentes: 0, suspensao: null } as never],
    [],
    2026,
  );
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].qtd_reclamacoes, 7);
  assert.equal(linhas[0].numerador, 8);
  assert.equal(linhas[0].meses_nao_aplicavel, 2);
  assert.equal(linhas[0].meses_nao_conforme, 0);
  assert.equal(linhas[0].pontos_mcb, 0);
});
