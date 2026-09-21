import "server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export type AuditoriaAgente = {
  id: string;
  cpf_agente: string;
  nome_agente: string | null;
  tipo: "externa" | "interna";
  pilar: string;
  pontuacao: number | null;
  subcriterios: Record<string, string>;
  data_avaliacao: string;
  observacoes: string;
  anexo_nome: string | null;
  registrado_em: string;
};

function caminho(): string {
  return join(process.cwd(), "dados", "preview", "auditorias.json");
}

export function carregarAuditoriasAgente(): AuditoriaAgente[] {
  const p = caminho();
  if (!existsSync(p)) return [];
  try {
    const bruto = JSON.parse(readFileSync(p, "utf8")) as AuditoriaAgente[];
    return Array.isArray(bruto) ? bruto : [];
  } catch {
    return [];
  }
}

export function gravarAuditoriaAgente(registro: AuditoriaAgente): void {
  const p = caminho();
  mkdirSync(join(process.cwd(), "dados", "preview"), { recursive: true });
  const atual = carregarAuditoriasAgente();
  atual.unshift(registro);
  writeFileSync(p, JSON.stringify(atual, null, 2), "utf8");
}
