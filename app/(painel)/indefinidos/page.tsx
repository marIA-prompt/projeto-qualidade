import { FilaIndefinidos } from "@/components/FilaIndefinidos";
import { carregarIndefinidos, carregarPerfil } from "@/lib/dados";

export default async function Page() {
  const [{ perfil }, itens] = await Promise.all([carregarPerfil(), carregarIndefinidos()]);
  return <FilaIndefinidos itens={itens} ehStaff={perfil?.role === "staff"} />;
}
