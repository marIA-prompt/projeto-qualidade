"use server";

import { revalidatePath } from "next/cache";
import { logConfirmacao, payloadConfirmacao } from "@/lib/indefinidos";
import { carregarPerfil, reclassificarMes, carregarClassificacoes } from "@/lib/dados";
import { pontuacaoPilar } from "@/lib/pilares";
import { createClient } from "@/lib/supabase/server";
import { montarRelatorioMensal } from "@/lib/relatorios";
import { mesIso } from "@/lib/format";

async function exigirStaff() {
  const { userId, perfil } = await carregarPerfil();
  if (!perfil || perfil.role !== "staff") {
    throw new Error("Somente a área de Qualidade pode executar esta ação.");
  }
  return userId;
}

export async function confirmarIndefinido(formData: FormData) {
  const userId = await exigirStaff();
  const tabela = String(formData.get("tabela") || "");
  const id = String(formData.get("id") || "");
  const destino = String(formData.get("destino") || "");
  const parecer = (formData.get("parecer") as string) || null;
  const mes = String(formData.get("mes") || "");
  if (tabela !== "reclamacoes" && tabela !== "acoes_judiciais") {
    return { ok: false, erro: "Tabela inválida." };
  }
  if (destino !== "corban" && destino !== "senff") {
    return { ok: false, erro: "Destino deve ser corban ou senff." };
  }
  const sb = await createClient();
  const payload = payloadConfirmacao(parecer, destino);
  const { error } = await sb.from(tabela).update(payload).eq("id", id);
  if (error) return { ok: false, erro: error.message };
  await sb.from("log_alteracoes").insert(
    logConfirmacao({
      tabela,
      registro_id: id,
      destino,
      usuario_id: userId,
      parecer_anterior: parecer,
      parecer_novo: payload.parecer,
    }),
  );
  await reclassificarMes(mes);
  revalidatePath("/indefinidos");
  revalidatePath("/");
  revalidatePath("/fechamento");
  return { ok: true, erro: null };
}

export async function registrarAuditoria(formData: FormData) {
  await exigirStaff();
  const tipo = String(formData.get("tipo") || "");
  const correspondente_id = String(formData.get("correspondente_id") || "");
  const pilar = String(formData.get("pilar") || "");
  const data_avaliacao = String(formData.get("data_avaliacao") || "");
  const observacoesBase = String(formData.get("observacoes") || "") || null;
  const tabela = tipo === "interna" ? "auditorias_internas" : "auditorias_externas";
  const subcriterios: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("sub_")) subcriterios[k.slice(4)] = String(v);
  }
  let observacoes = observacoesBase;
  const anexo = formData.get("anexo");
  if (anexo instanceof File && anexo.size > 0) {
    const nome = anexo.name.toLowerCase();
    if (anexo.type !== "application/pdf" && !nome.endsWith(".pdf")) {
      return { ok: false, erro: "O anexo da auditoria deve ser PDF." };
    }
    const sbUp = await createClient();
    const seguro = anexo.name.replace(/[^\w.\-]+/g, "_");
    const path = `${tabela}/${correspondente_id}/${data_avaliacao}-${seguro}`;
    const { error: upErr } = await sbUp.storage.from("auditorias").upload(path, anexo, {
      contentType: "application/pdf",
      upsert: true,
    });
    observacoes = [observacoes, upErr ? `Anexo PDF (não enviado ao storage): ${anexo.name}` : `Anexo PDF: ${path}`]
      .filter(Boolean)
      .join("\n");
    if (upErr) {
      observacoes = `${observacoes}\n(Storage: ${upErr.message}. Crie o bucket 'auditorias' no Supabase se ainda não existir.)`;
    }
  }
  const sb = await createClient();
  const { error } = await sb.from(tabela).insert({
    correspondente_id,
    pilar,
    pontuacao: pontuacaoPilar(subcriterios),
    subcriterios,
    data_avaliacao,
    observacoes,
  });
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/auditorias");
  revalidatePath("/");
  return { ok: true, erro: null };
}

export async function registrarMedida(formData: FormData) {
  const userId = await exigirStaff();
  const sb = await createClient();
  const correspondente_id = String(formData.get("correspondente_id") || "");
  const medida_id = Number(formData.get("medida_id"));
  const data_aplicacao = String(formData.get("data_aplicacao") || "");
  const motivo = String(formData.get("motivo") || "") || null;
  const classif_id = String(formData.get("classificacao_id") || "") || null;
  const { error } = await sb.from("medidas_aplicadas").insert({
    correspondente_id,
    medida_id,
    classificacao_mensal_id: classif_id,
    data_aplicacao,
    aplicada_por: userId,
    motivo,
  });
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/medidas");
  revalidatePath("/relacionamento");
  return { ok: true, erro: null };
}

export async function registrarRelatorio(formData: FormData) {
  await exigirStaff();
  const mes = String(formData.get("mes") || "");
  const destinatario = String(formData.get("destinatario") || "");
  const correspondente = String(formData.get("correspondente") || "") || null;
  const hist = await carregarClassificacoes();
  const df = hist.filter((r) => r.mes_referencia === mesIso(mes));
  const recorte = correspondente ? df.filter((r) => r.correspondente === correspondente) : df;
  const { assunto, corpo } = montarRelatorioMensal({
    mes,
    linhas: recorte,
    correspondente,
  });
  const sb = await createClient();
  const { userId } = await carregarPerfil();
  const smtpOk = Boolean(process.env.SMTP_HOST && process.env.SMTP_USUARIO);
  await sb.from("relatorios_mensais").insert({
    mes_referencia: mesIso(mes),
    destinatario,
    assunto,
    corpo,
    status: smtpOk ? "enviado" : "falhou",
    erro: smtpOk
      ? null
      : "SMTP ainda não configurado na Vercel (SMTP_HOST / SMTP_USUARIO / SMTP_SENHA). O relatório foi gerado para download.",
    enviado_por: userId,
  });
  revalidatePath("/relatoria");
  return {
    ok: smtpOk,
    assunto,
    corpo,
    erro: smtpOk
      ? null
      : "SMTP ainda não configurado. Baixe o relatório; o envio liga quando SMTP_* estiver no projeto Vercel.",
  };
}

export async function sair() {
  const sb = await createClient();
  await sb.auth.signOut();
}
