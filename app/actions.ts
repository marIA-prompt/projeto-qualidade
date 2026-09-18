"use server";

import { revalidatePath } from "next/cache";
import { logConfirmacao, payloadConfirmacao } from "@/lib/indefinidos";
import { alertasDoMes, carregarPerfil, carregarClassificacoes, reclassificarMes, resumoAuditorias } from "@/lib/dados";
import { carregarClassificacoesAnuais } from "@/lib/anual";
import { classificarAnual } from "@/lib/motorAnual";
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
import {
  assuntoRelatorioAnual,
  montarDadosRelatorioAnual,
  nomeArquivoRelatorioAnual,
  relatorioHtmlAnual,
  relatorioMarkdownAnual,
} from "@/lib/relatorioAnual";
import { relatorioPdfAnual } from "@/lib/relatorioAnualPdf";
import {
  caminhoAnexoAuditoria,
  caminhoUploadAuditoria,
  pdfAuditoriaValido,
  tabelaAuditoriaValida,
} from "@/lib/auditoriaAnexo";
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
  try {
    await exigirStaff();
    const tipo = String(formData.get("tipo") || "");
    const correspondente_id = String(formData.get("correspondente_id") || "");
    const pilar = String(formData.get("pilar") || "");
    const data_avaliacao = String(formData.get("data_avaliacao") || "");
    const observacoesBase = String(formData.get("observacoes") || "") || null;
    const tabela = tipo === "interna" ? "auditorias_internas" : "auditorias_externas";
    if (!tabelaAuditoriaValida(tabela)) {
      return { ok: false, erro: "Tipo de auditoria inválido." };
    }
    const subcriterios: Record<string, string> = {};
    for (const [k, v] of formData.entries()) {
      if (k.startsWith("sub_")) subcriterios[k.slice(4)] = String(v);
    }
    let observacoes = observacoesBase;
    const anexo = formData.get("anexo");
    if (anexo instanceof File && anexo.size > 0) {
      const rejeicao = pdfAuditoriaValido(anexo);
      if (rejeicao) return { ok: false, erro: rejeicao };
      const sbUp = await createClient();
      const path = caminhoUploadAuditoria({
        tabela,
        correspondenteId: correspondente_id,
        dataAvaliacao: data_avaliacao,
        nomeArquivo: anexo.name,
      });
      try {
        const bytes = new Uint8Array(await anexo.arrayBuffer());
        const { error: upErr } = await sbUp.storage.from("auditorias").upload(path, bytes, {
          contentType: "application/pdf",
          upsert: false,
        });
        if (upErr) {
          return {
            ok: false,
            erro: `Não foi possível enviar o PDF (${upErr.message}). A auditoria não foi gravada.`,
          };
        }
        observacoes = [observacoes, `Anexo PDF: ${path}`].filter(Boolean).join("\n");
      } catch (e) {
        const detalhe = e instanceof Error ? e.message : "falha desconhecida";
        return {
          ok: false,
          erro: `Não foi possível enviar o PDF (${detalhe}). A auditoria não foi gravada.`,
        };
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
    revalidatePath("/monitoramento-anual");
    revalidatePath("/");
    return { ok: true, erro: null };
  } catch (e) {
    const detalhe = e instanceof Error ? e.message : "falha desconhecida";
    return { ok: false, erro: detalhe };
  }
}

export async function excluirAuditoria(formData: FormData) {
  try {
    await exigirStaff();
    const id = String(formData.get("id") || "");
    const tabela = String(formData.get("tabela") || "");
    if (!id) return { ok: false, erro: "Registro inválido." };
    if (!tabelaAuditoriaValida(tabela)) return { ok: false, erro: "Tipo de auditoria inválido." };
    const sb = await createClient();
    const { data: atual, error: getErr } = await sb.from(tabela).select("id, observacoes").eq("id", id).maybeSingle();
    if (getErr) return { ok: false, erro: getErr.message };
    if (!atual) return { ok: false, erro: "Registro não encontrado." };
    const anexo = caminhoAnexoAuditoria(atual.observacoes);
    const { error } = await sb.from(tabela).delete().eq("id", id);
    if (error) return { ok: false, erro: error.message };
    if (anexo) {
      await sb.storage.from("auditorias").remove([anexo]);
    }
    revalidatePath("/auditorias");
    revalidatePath("/monitoramento-anual");
    revalidatePath("/");
    return { ok: true, erro: null };
  } catch (e) {
    const detalhe = e instanceof Error ? e.message : "falha desconhecida";
    return { ok: false, erro: detalhe };
  }
}

export async function registrarMedida(formData: FormData) {
  const userId = await exigirStaff();
  const sb = await createClient();
  const correspondente_id = String(formData.get("correspondente_id") || "");
  const medida_id = Number(formData.get("medida_id"));
  const data_aplicacao = String(formData.get("data_aplicacao") || "");
  const motivo = String(formData.get("motivo") || "") || null;
  const classif_id = String(formData.get("classificacao_id") || "") || null;
  const classif_anual_id = String(formData.get("classificacao_anual_id") || "") || null;
  const { error } = await sb.from("medidas_aplicadas").insert({
    correspondente_id,
    medida_id,
    classificacao_mensal_id: classif_id,
    classificacao_anual_id: classif_anual_id,
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
    try {
      const bytes = await relatorioPdf(dados);
      base64 = Buffer.from(bytes).toString("base64");
      mime = "application/pdf";
      filename = nomeArquivoRelatorio(dados, "pdf");
    } catch (e) {
      const detalhe = e instanceof Error ? e.message : "falha desconhecida";
      return {
        ok: false,
        erro: `Não foi possível gerar o PDF (${detalhe}). Tente HTML ou Markdown.`,
        filename: "",
        mime: "",
        texto: null,
        base64: null,
        registrado: false,
      };
    }
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

export async function gerarERegistrarRelatorioAnual(formData: FormData) {
  const { userId, perfil } = await carregarPerfil();
  const ano = Number(formData.get("ano"));
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) {
    return { ok: false, erro: "Ano inválido.", filename: "", mime: "", texto: null, base64: null, registrado: false };
  }
  const destinatario = String(formData.get("destinatario") || "").trim() || "maria.morais@senff.com.br";
  const correspondente = String(formData.get("correspondente") || "") || null;
  const formato = String(formData.get("formato") || "html");
  if (!["html", "md", "pdf"].includes(formato)) {
    return { ok: false, erro: "Formato inválido.", filename: "", mime: "", texto: null, base64: null, registrado: false };
  }
  const linhas = await carregarClassificacoesAnuais(ano);
  const recorte = correspondente ? linhas.filter((r) => r.correspondente === correspondente) : linhas;
  const sb = await createClient();
  const { data: aplicadas } = await sb
    .from("medidas_aplicadas")
    .select("data_aplicacao, motivo, correspondente_id, correspondentes(nome), medidas_administrativas(nivel, descricao, codigo), classificacao_anual_id")
    .not("classificacao_anual_id", "is", null)
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
  const dados = montarDadosRelatorioAnual({ ano, linhas: recorte, correspondente, medidas });
  const assunto = assuntoRelatorioAnual(dados);
  const md = relatorioMarkdownAnual(dados);
  let texto: string | null = null;
  let base64: string | null = null;
  let mime = "text/html;charset=utf-8";
  let filename = nomeArquivoRelatorioAnual(dados, "html");
  if (formato === "md") {
    texto = md;
    mime = "text/markdown;charset=utf-8";
    filename = nomeArquivoRelatorioAnual(dados, "md");
  } else if (formato === "pdf") {
    try {
      const bytes = await relatorioPdfAnual(dados);
      base64 = Buffer.from(bytes).toString("base64");
      mime = "application/pdf";
      filename = nomeArquivoRelatorioAnual(dados, "pdf");
    } catch (e) {
      const detalhe = e instanceof Error ? e.message : "falha desconhecida";
      return {
        ok: false,
        erro: `Não foi possível gerar o PDF (${detalhe}). Tente HTML ou Markdown.`,
        filename: "",
        mime: "",
        texto: null,
        base64: null,
        registrado: false,
      };
    }
  } else {
    texto = relatorioHtmlAnual(dados);
  }

  let registrado = false;
  if (perfil?.role === "staff") {
    const { error } = await sb.from("relatorios_mensais").insert({
      mes_referencia: `${ano}-01-01`,
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
    revalidatePath("/monitoramento-anual");
  }
  return { ok: true, erro: null, filename, mime, texto, base64, registrado };
}

export async function marcarDesvioGrave(formData: FormData) {
  const userId = await exigirStaff();
  const correspondente_id = String(formData.get("correspondente_id") || "");
  const ano = Number(formData.get("ano"));
  const desvio = String(formData.get("desvio") || "") === "1";
  if (!correspondente_id || !Number.isInteger(ano)) return { ok: false, erro: "Dados incompletos." };
  const linhas = await carregarClassificacoesAnuais(ano);
  const linha = linhas.find((r) => r.correspondente_id === correspondente_id);
  const resultado = classificarAnual({
    pontuacaoGeral: linha?.pontuacao_geral ?? null,
    desvioCondutaGrave: desvio,
  });
  const sb = await createClient();
  const { error } = await sb.from("classificacoes_anuais").upsert(
    {
      correspondente_id,
      ano_referencia: ano,
      pontuacao_geral: resultado.pontuacao,
      desvio_conduta_grave: desvio,
      status: resultado.status === "nao_aplicavel" ? null : resultado.status,
      calculado_em: new Date().toISOString(),
    },
    { onConflict: "correspondente_id,ano_referencia" },
  );
  if (error) return { ok: false, erro: error.message };
  void userId;
  revalidatePath("/monitoramento-anual");
  return { ok: true, erro: null };
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
