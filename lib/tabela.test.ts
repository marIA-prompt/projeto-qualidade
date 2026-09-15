import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LINHAS_POR_PAGINA,
  compararValores,
  fatiarPagina,
  ordenarLinhas,
  totalPaginas,
} from "./tabela.ts";

test("paginação mostra 10 por página", () => {
  const linhas = Array.from({ length: 23 }, (_, i) => ({ n: i + 1 }));
  assert.equal(LINHAS_POR_PAGINA, 10);
  assert.equal(totalPaginas(linhas.length), 3);
  assert.deepEqual(
    fatiarPagina(linhas, 1).map((r) => r.n),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.deepEqual(
    fatiarPagina(linhas, 3).map((r) => r.n),
    [21, 22, 23],
  );
});

test("página além do fim volta para a última", () => {
  const linhas = [{ n: 1 }, { n: 2 }];
  assert.deepEqual(
    fatiarPagina(linhas, 9).map((r) => r.n),
    [1, 2],
  );
});

test("ordena números crescente e decrescente", () => {
  const linhas = [{ n: 12 }, { n: 3 }, { n: 7 }];
  assert.deepEqual(
    ordenarLinhas(linhas, "n", "asc").map((r) => r.n),
    [3, 7, 12],
  );
  assert.deepEqual(
    ordenarLinhas(linhas, "n", "desc").map((r) => r.n),
    [12, 7, 3],
  );
});

test("ordena texto com número embutido", () => {
  const linhas = [
    { m: "CONECT teve 41 reclamações" },
    { m: "ACG (S) teve 6 reclamações" },
    { m: "CAPITAL 2 teve 12 reclamações" },
  ];
  assert.deepEqual(
    ordenarLinhas(linhas, "m", "asc").map((r) => r.m),
    [
      "ACG (S) teve 6 reclamações",
      "CAPITAL 2 teve 12 reclamações",
      "CONECT teve 41 reclamações",
    ],
  );
});

test("compara valores nulos por último no crescente textual", () => {
  assert.ok(compararValores(null, "A") < 0);
  assert.ok(compararValores("A", "a") === 0);
});
