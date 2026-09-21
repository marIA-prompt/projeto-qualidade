"use server";

import { revalidatePath } from "next/cache";
import { carregarPerfil } from "@/lib/dados";
import { carregarSnapshot } from "@/lib/agentes/snapshot";
import { gravarAuditoriaAgente } from "@/lib/agentes/auditorias";
import { pontuacaoPilar } from "@/lib/pilares";

export async function registrarAuditoriaAgente(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sessao = await carregarPerfil();
  if (!sessao.perfil || sessao.perfil.role !== "staff") {
    return { ok: false, erro: "Somente a área de Qualidade registra auditorias." };
  }
  const bruto = String(formData.get("cpf_agente") || "").replace(/\D/g, "");
  const cpf = bruto.length > 0 && bruto.length <= 11 ? bruto.padStart(11, "0") : bruto;
  if (!/^\d{11}$/.test(cpf)) {
    return { ok: false, erro: "Selecione um agente com CPF válido." };
  }
  const subcriterios: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (String(k).startsWith("sub_")) subcriterios[String(k).slice(4)] = String(v);
  }
  const snap = carregarSnapshot();
  const agente = snap.classificacoes.find((c) => c.cpf_agente === cpf);
  const anexo = formData.get("anexo");
  const anexoNome = anexo instanceof File && anexo.size > 0 ? anexo.name : null;
  gravarAuditoriaAgente({
    id: crypto.randomUUID(),
    cpf_agente: cpf,
    nome_agente: agente?.nome_agente || null,
    tipo: formData.get("tipo") === "interna" ? "interna" : "externa",
    pilar: String(formData.get("pilar") || "relacionamento_cliente"),
    pontuacao: pontuacaoPilar(subcriterios),
    subcriterios,
    data_avaliacao: String(formData.get("data_avaliacao") || ""),
    observacoes: String(formData.get("observacoes") || "").trim(),
    anexo_nome: anexoNome,
    registrado_em: new Date().toISOString(),
  });
  revalidatePath("/agentes/auditorias");
  return { ok: true };
}
