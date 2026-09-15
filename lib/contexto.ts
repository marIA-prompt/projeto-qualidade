import { alertasDoMes, carregarClassificacoes, carregarPerfil, resumoAuditorias } from "./dados";
import { correspondentesDoHistorico, corbanValido, filtrarCorban } from "./filtros";
import { mesIso } from "./format";

export async function contextoPainel(mesParam?: string | null, corbanParam?: string | null) {
  const sessao = await carregarPerfil();
  const histCompleto = await carregarClassificacoes();
  const meses = [...new Set(histCompleto.map((h) => h.mes_referencia))].sort().reverse();
  const correspondentes = correspondentesDoHistorico(histCompleto);
  const corban = corbanValido(corbanParam, correspondentes);
  const hist = filtrarCorban(histCompleto, corban);
  const mes = mesIso(mesParam || meses[0] || "");
  const df = mes ? hist.filter((h) => h.mes_referencia === mes) : [];
  const resumo = await resumoAuditorias();
  const alertas = alertasDoMes(df, resumo, mes);
  return { ...sessao, hist, histCompleto, meses, mes, df, resumo, alertas, correspondentes, corban };
}
