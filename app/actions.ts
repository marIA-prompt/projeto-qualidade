"use server";

import { revalidatePath } from "next/cache";
import { logConfirmacao, payloadConfirmacao } from "@/lib/indefinidos";
import { alertasDoMes, carregarPerfil, carregarClassificacoes, reclassificarMes, resumoAuditorias } from "@/lib/dados";
import { pontuacaoPilar } from "@/lib/pilares";
import { chaveAcompanhamentoValida } from "@/lib/filtros";
import {
  assuntoRelatorio,
  montarDadosRelatorio,
  nomeArquivoRelatorio,
  relatorioHtml,
  relatorioMarkdown,
  type MedidaHistorico,
} from "@/lib/relatorioModelo";
import { relatorioPdf } from "@/lib/relatorioPdf";
import { createClient } from "@/lib/supabase/server";
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

export async function gerarERegistrarRelatorio(formData: FormData) {
  const { userId, perfil } = await carregarPerfil();
  const mes = mesIso(formData.get("mes"));
  const destinatario = String(formData.get("destinatario") || "").trim() || "maria.morais@senff.com.br";
  const correspondente = String(formData.get("correspondente") || "") || null;
  const formato = String(formData.get("formato") || "html");
  if (!["html", "md", "pdf"].includes(formato)) {
    return { ok: false, erro: "Formato inválido.", filename: "", mime: "", texto: null, base64: null, registrado: false };
  }
  const hist = await carregarClassificacoes();
  const dfMes = hist.filter((r) => r.mes_referencia === mes);
  const recorte = correspondente ? dfMes.filter((r) => r.correspondente === correspondente) : dfMes;
  const resumo = await resumoAuditorias();
  const alertas = alertasDoMes(dfMes, resumo, mes);
  const sb = await createClient();
  const { data: aplicadas } = await sb
    .from("medidas_aplicadas")
    .select("data_aplicacao, motivo, correspondente_id, correspondentes(nome), medidas_administrativas(nivel, descricao, codigo)")
    .order("data_aplicacao", { ascending: false });
  const medidas: MedidaHistorico[] = (aplicadas || []).map((m) => {
    const corr = m.correspondentes as { nome?: string } | null;
    const med = m.medidas_administrativas as { nivel?: number; descricao?: string; codigo?: string } | null;
    const tipo = med?.nivel ? `Nível ${med.nivel}` : med?.codigo || "Medida";
    const descricao = med?.descricao || m.motivo || "Medida registrada";
    return {
      correspondente_id: m.correspondente_id,
      correspondente: corr?.nome,
      data_aplicacao: m.data_aplicacao,
      tipo,
      descricao: m.motivo ? `${descricao} (${m.motivo})` : descricao,
    };
  });
  const dados = montarDadosRelatorio({
    mes,
    linhas: recorte,
    correspondente,
    hist,
    alertas,
    medidas,
  });
  const assunto = assuntoRelatorio(dados);
  const md = relatorioMarkdown(dados);
  let texto: string | null = null;
  let base64: string | null = null;
  let mime = "text/html;charset=utf-8";
  let filename = nomeArquivoRelatorio(dados, "html");
  if (formato === "md") {
    texto = md;
    mime = "text/markdown;charset=utf-8";
    filename = nomeArquivoRelatorio(dados, "md");
  } else if (formato === "pdf") {
    const bytes = await relatorioPdf(dados);
    base64 = Buffer.from(bytes).toString("base64");
    mime = "application/pdf";
    filename = nomeArquivoRelatorio(dados, "pdf");
  } else {
    texto = relatorioHtml(dados);
  }

  let registrado = false;
  if (perfil?.role === "staff") {
    const { error } = await sb.from("relatorios_mensais").insert({
      mes_referencia: mes,
      destinatario,
      assunto,
      corpo: md,
      status: "gerado",
      erro: null,
      enviado_por: userId,
    });
    if (error) {
      return { ok: false, erro: error.message, filename: "", mime: "", texto: null, base64: null, registrado: false };
    }
    registrado = true;
    revalidatePath("/relatoria");
  }

  return { ok: true, erro: null, filename, mime, texto, base64, registrado };
}

export async function registrarAcompanhamento(formData: FormData) {
  const userId = await exigirStaff();
  const correspondente_id = String(formData.get("correspondente_id") || "");
  const mes = mesIso(formData.get("mes"));
  const chave = String(formData.get("chave") || "");
  if (!correspondente_id || !mes) return { ok: false, erro: "Correspondente ou mês ausente." };
  if (!chaveAcompanhamentoValida(chave)) return { ok: false, erro: "Chave de acompanhamento inválida." };

  const sb = await createClient();
  const { data: atual } = await sb
    .from("acompanhamento_acoes")
    .select("acao_realizada, data_acao")
    .eq("correspondente_id", correspondente_id)
    .eq("mes_referencia", mes)
    .eq("chave", chave)
    .maybeSingle();

  let acao_realizada = Boolean(atual?.acao_realizada);
  let data_acao = (atual?.data_acao as string | null) || null;
  if (formData.has("acao_realizada")) {
    acao_realizada = String(formData.get("acao_realizada")) === "true";
  }
  if (formData.has("data_acao")) {
    data_acao = String(formData.get("data_acao") || "") || null;
  }
  if (acao_realizada && !data_acao && String(formData.get("preencher_data_se_vazia") || "") === "true") {
    data_acao = new Date().toISOString().slice(0, 10);
  }

  const { error } = await sb.from("acompanhamento_acoes").upsert(
    {
      correspondente_id,
      mes_referencia: mes,
      chave,
      acao_realizada,
      data_acao,
      atualizado_por: userId,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "correspondente_id,mes_referencia,chave" },
  );
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/relacionamento");
  return { ok: true, erro: null };
}

export async function sair() {
  const sb = await createClient();
  await sb.auth.signOut();
}
