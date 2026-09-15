import { PainelCorrespondente } from "@/components/PainelCorrespondente";
import { contextoPainel } from "@/lib/contexto";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; corban?: string }>;
}) {
  const { mes, corban } = await searchParams;
  const ctx = await contextoPainel(mes, corban);
  return (
    <PainelCorrespondente
      df={ctx.df}
      hist={ctx.hist}
      resumo={ctx.resumo}
      alertas={ctx.alertas}
      filtroGlobal={Boolean(ctx.corban)}
    />
  );
}
