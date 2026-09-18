import assert from "node:assert/strict";
import { test } from "node:test";
import {
  caminhoAnexoAuditoria,
  caminhoUploadAuditoria,
  pdfAuditoriaValido,
  tabelaAuditoriaValida,
} from "./auditoriaAnexo.ts";

test("só aceita as duas tabelas de auditoria", () => {
  assert.equal(tabelaAuditoriaValida("auditorias_externas"), true);
  assert.equal(tabelaAuditoriaValida("auditorias_internas"), true);
  assert.equal(tabelaAuditoriaValida("reclamacoes"), false);
});

test("extrai o caminho do PDF gravado nas observações", () => {
  assert.equal(
    caminhoAnexoAuditoria("Anexo PDF: auditorias_externas/abc/2026-09-18-1-rel.pdf"),
    "auditorias_externas/abc/2026-09-18-1-rel.pdf",
  );
  assert.equal(caminhoAnexoAuditoria("sem anexo"), null);
  assert.equal(caminhoAnexoAuditoria("Anexo PDF (não enviado ao storage): x.pdf"), null);
});

test("rejeita anexo que não é PDF ou passa de 8 MB", () => {
  assert.equal(pdfAuditoriaValido({ name: "a.pdf", type: "application/pdf", size: 10 }), null);
  assert.match(String(pdfAuditoriaValido({ name: "a.png", type: "image/png", size: 10 })), /PDF/);
  assert.match(
    String(pdfAuditoriaValido({ name: "a.pdf", type: "application/pdf", size: 9 * 1024 * 1024 })),
    /8 MB/,
  );
});

test("monta caminho seguro no bucket", () => {
  const path = caminhoUploadAuditoria({
    tabela: "auditorias_externas",
    correspondenteId: "cid",
    dataAvaliacao: "2026-09-18",
    nomeArquivo: "Relatório (final).PDF",
    agora: 1,
  });
  assert.equal(path, "auditorias_externas/cid/2026-09-18-1-Relat_rio_final_.PDF");
});
