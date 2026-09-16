import { AlertasRelatorios } from "@/components/AlertasRelatorios";
import { contextoPainel } from "@/lib/contexto";
import type { MedidaHistorico } from "@/lib/relatorioModelo";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; corban?: string }>;
}) {
  const { mes, corban } = await searchParams;
  const ctx = await contextoPainel(mes, corban);
  const sb = await createClient();
  const { data: historico } =
    ctx.perfil?.role === "staff"
      ? await sb
          .from("relatorios_mensais")
          .select("created_at, mes_referencia, destinatario, assunto, status, erro")
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [] };
  const { data: aplicadas } = await sb
    .from("medidas_aplicadas")
    .select(
      "data_aplicacao, motivo, correspondente_id, correspondentes(nome), medidas_administrativas(nivel, descricao, codigo)",
    )
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
    <AlertasRelatorios
      mes={ctx.mes}
      df={ctx.df}
      hist={ctx.hist}
      alertas={ctx.alertas}
      medidas={medidas}
      historico={historico || []}
      destPadrao={ctx.email || "maria.morais@senff.com.br"}
      ehStaff={ctx.perfil?.role === "staff"}
    />
  );
}
