import { MonitoramentoAnual } from "@/components/MonitoramentoAnual";
import { alertasAnuais, anosDisponiveis, carregarClassificacoesAnuais } from "@/lib/anual";
import { contextoPainel } from "@/lib/contexto";
import type { MedidaHistorico } from "@/lib/relatorioModelo";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; corban?: string; ano?: string }>;
}) {
  const { mes, corban, ano: anoParam } = await searchParams;
  const ctx = await contextoPainel(mes, corban);
  const anos = anosDisponiveis(ctx.meses.length ? ctx.meses : [`${new Date().getFullYear()}-01-01`]);
  const ano = Number(anoParam) || anos[0] || new Date().getFullYear();
  const linhasBrutas = await carregarClassificacoesAnuais(ano);
  const linhas = ctx.corban
    ? linhasBrutas.filter((r) => r.correspondente_id === ctx.corban)
    : linhasBrutas;
  const sb = await createClient();
  const { data: historico } =
    ctx.perfil?.role === "staff"
      ? await sb
          .from("relatorios_mensais")
          .select("created_at, mes_referencia, destinatario, assunto, status, erro")
          .ilike("assunto", "%Relatório anual%")
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [] };
  const { data: aplicadas } = await sb
    .from("medidas_aplicadas")
    .select(
      "data_aplicacao, motivo, correspondente_id, correspondentes(nome), medidas_administrativas(nivel, descricao, codigo), classificacao_anual_id",
    )
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
  return (
    <MonitoramentoAnual
      ano={ano}
      anos={anos}
      linhas={linhas}
      alertas={alertasAnuais(linhas)}
      medidas={medidas}
      historico={historico || []}
      destPadrao={ctx.email || "maria.morais@senff.com.br"}
      ehStaff={ctx.perfil?.role === "staff"}
    />
  );
}
