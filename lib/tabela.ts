export const LINHAS_POR_PAGINA = 10;

export function textoParaOrdenar(valor: unknown): string {
  if (valor == null) return "";
  if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") {
    return String(valor);
  }
  return "";
}

const SO_NUMERO = /^-?\d+([.,]\d+)?$/;

export function compararValores(a: unknown, b: unknown): number {
  const sa = textoParaOrdenar(a).trim();
  const sb = textoParaOrdenar(b).trim();
  const aNum = SO_NUMERO.test(sa.replace(/\s/g, ""));
  const bNum = SO_NUMERO.test(sb.replace(/\s/g, ""));
  if (aNum && bNum) {
    return Number(sa.replace(",", ".")) - Number(sb.replace(",", "."));
  }
  return sa.localeCompare(sb, "pt-BR", { numeric: true, sensitivity: "base" });
}

export function ordenarLinhas<T extends Record<string, unknown>>(
  linhas: T[],
  chave: string | null,
  direcao: "asc" | "desc",
): T[] {
  if (!chave) return [...linhas];
  const fator = direcao === "asc" ? 1 : -1;
  return [...linhas].sort((x, y) => fator * compararValores(x[chave], y[chave]));
}

export function fatiarPagina<T>(itens: T[], pagina: number, tamanho = LINHAS_POR_PAGINA): T[] {
  const total = Math.max(1, Math.ceil(itens.length / tamanho) || 1);
  const p = Math.min(Math.max(1, pagina), total);
  const inicio = (p - 1) * tamanho;
  return itens.slice(inicio, inicio + tamanho);
}

export function totalPaginas(qtd: number, tamanho = LINHAS_POR_PAGINA): number {
  return Math.max(1, Math.ceil(qtd / tamanho) || 1);
}
