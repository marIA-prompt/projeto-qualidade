import { alertasDoMes, carregarClassificacoes, carregarPerfil, resumoAuditorias } from "./dados";
import { mesIso } from "./format";

export async function contextoPainel(mesParam?: string | null) {
  const sessao = await carregarPerfil();
  const hist = await carregarClassificacoes();
  const meses = [...new Set(hist.map((h) => h.mes_referencia))].sort().reverse();
  const mes = mesIso(mesParam || meses[0] || "");
  const df = mes ? hist.filter((h) => h.mes_referencia === mes) : [];
  const resumo = await resumoAuditorias();
  const alertas = alertasDoMes(df, resumo, mes);
  return { ...sessao, hist, meses, mes, df, resumo, alertas };
}
