import { PainelCorrespondente } from "@/components/PainelCorrespondente";
import { contextoPainel } from "@/lib/contexto";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const ctx = await contextoPainel(mes);
  return (
    <PainelCorrespondente
      df={ctx.df}
      hist={ctx.hist}
      resumo={ctx.resumo}
      alertas={ctx.alertas}
    />
  );
}
