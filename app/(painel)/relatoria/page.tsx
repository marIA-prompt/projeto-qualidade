import { AlertasRelatorios } from "@/components/AlertasRelatorios";
import { contextoPainel } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; corban?: string }>;
}) {
  const { mes, corban } = await searchParams;
  const ctx = await contextoPainel(mes, corban);
  const sb = await createClient();
  const { data: historico } = ctx.perfil?.role === "staff"
    ? await sb
        .from("relatorios_mensais")
        .select("created_at, mes_referencia, destinatario, assunto, status, erro")
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] };
  return (
    <AlertasRelatorios
      mes={ctx.mes}
      df={ctx.df}
      alertas={ctx.alertas}
      historico={historico || []}
      ehStaff={ctx.perfil?.role === "staff"}
    />
  );
}
