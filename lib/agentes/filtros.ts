import { mesChave } from "./format";

export type AgenteOpcao = { cpf: string; nome: string; mascara: string };

export function queryPainel(atual: { mes?: string | null; cpf?: string | null }): string {
  const p = new URLSearchParams();
  if (atual.mes) p.set("mes", mesChave(atual.mes));
  if (atual.cpf) p.set("cpf", atual.cpf);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function agentesUnicos(
  linhas: { cpf_agente: string; nome_agente?: string | null; cpf_agente_mascarado?: string }[],
): AgenteOpcao[] {
  const map = new Map<string, AgenteOpcao>();
  for (const l of linhas) {
    if (!l.cpf_agente || map.has(l.cpf_agente)) continue;
    map.set(l.cpf_agente, {
      cpf: l.cpf_agente,
      nome: l.nome_agente || l.cpf_agente_mascarado || l.cpf_agente,
      mascara: l.cpf_agente_mascarado || "",
    });
  }
  return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
