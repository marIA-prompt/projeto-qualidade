import { NextResponse, type NextRequest } from "next/server";
import { contextoAgentes } from "@/lib/agentes/contexto";
import { relatorioAgenteHtml } from "@/lib/agentes/relatorio";
import { carregarPerfil } from "@/lib/dados";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessao = await carregarPerfil();
  if (!sessao.perfil) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const mes = request.nextUrl.searchParams.get("mes") || undefined;
  const cpf = request.nextUrl.searchParams.get("cpf") || undefined;
  const ctx = await contextoAgentes(mes, cpf);
  if (!ctx.cpf || !ctx.df[0]) {
    return new NextResponse("Informe um agente com classificação no mês.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const html = relatorioAgenteHtml({
    clf: ctx.df[0],
    mcb: ctx.mcb[0],
    fraude: ctx.fraude[0],
    staff: ctx.role === "staff",
    geradoEm: new Date().toLocaleString("pt-BR"),
  });
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
