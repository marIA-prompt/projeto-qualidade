const LIMITE_PDF_BYTES = 8 * 1024 * 1024;

export function tabelaAuditoriaValida(tabela: string): tabela is "auditorias_externas" | "auditorias_internas" {
  return tabela === "auditorias_externas" || tabela === "auditorias_internas";
}

export function caminhoAnexoAuditoria(observacoes: string | null | undefined): string | null {
  const m = String(observacoes || "").match(/^Anexo PDF:\s+(\S+)/m);
  if (!m) return null;
  const path = m[1];
  if (path.includes("(não") || path.includes("(")) return null;
  return path;
}

export function pdfAuditoriaValido(anexo: { name: string; type: string; size: number }): string | null {
  const nome = anexo.name.toLowerCase();
  const ehPdf = anexo.type === "application/pdf" || nome.endsWith(".pdf");
  if (!ehPdf) return "O anexo da auditoria deve ser PDF.";
  if (anexo.size > LIMITE_PDF_BYTES) {
    return "O PDF deve ter no máximo 8 MB.";
  }
  return null;
}

export function caminhoUploadAuditoria(args: {
  tabela: string;
  correspondenteId: string;
  dataAvaliacao: string;
  nomeArquivo: string;
  agora?: number;
}): string {
  const seguro = args.nomeArquivo.replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "") || "relatorio.pdf";
  const stamp = args.agora ?? Date.now();
  return `${args.tabela}/${args.correspondenteId}/${args.dataAvaliacao}-${stamp}-${seguro}`;
}
