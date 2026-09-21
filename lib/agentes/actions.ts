"use server";

import { revalidatePath } from "next/cache";
import { carregarPerfil } from "@/lib/dados";
import { carregarSnapshot } from "@/lib/agentes/snapshot";
import { gravarAuditoriaAgente } from "@/lib/agentes/auditorias";
import { parsePontuacaoManual, PILARES } from "@/lib/pilares";

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
  const pilar = String(formData.get("pilar") || "");
  if (!(pilar in PILARES)) {
    return { ok: false, erro: "Selecione um dos 5 pilares do relatório." };
  }
  const pontuacaoParse = parsePontuacaoManual(formData.get("pontuacao"));
  if (!pontuacaoParse.ok) return { ok: false, erro: pontuacaoParse.erro };
  const snap = carregarSnapshot();
  const agente = snap.classificacoes.find((c) => c.cpf_agente === cpf);
  const anexo = formData.get("anexo");
  const anexoNome = anexo instanceof File && anexo.size > 0 ? anexo.name : null;
  gravarAuditoriaAgente({
    id: crypto.randomUUID(),
    cpf_agente: cpf,
    nome_agente: agente?.nome_agente || null,
    tipo: formData.get("tipo") === "interna" ? "interna" : "externa",
    pilar,
    pontuacao: pontuacaoParse.valor,
    subcriterios: {},
    data_avaliacao: String(formData.get("data_avaliacao") || ""),
    observacoes: String(formData.get("observacoes") || "").trim(),
    anexo_nome: anexoNome,
    registrado_em: new Date().toISOString(),
  });
  revalidatePath("/agentes/auditorias");
  return { ok: true };
}
