import { redirect } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  redirect(mes ? `/relatoria?mes=${encodeURIComponent(mes)}` : "/relatoria");
}
