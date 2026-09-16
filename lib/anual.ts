import { eProcedenteCorban } from "./motor";
import {
  anosDisponiveis,
  classificarAnual,
  medidaSugeridaAnual,
  pontuacaoGeral,
  pontuacaoOperacional,
  type StatusAnual,
} from "./motorAnual";
import { createClient } from "./supabase/server";

export { anosDisponiveis };

export type ClassificacaoAnual = {
  id: string | null;
  correspondente_id: string;
  correspondente: string;
  cnpj: string;
  ano: number;
  pontuacao_geral: number | null;
  pontuacao_operacional: number | null;
  pontuacao_qualitativa: number | null;
  desvio_conduta_grave: boolean;
  status: StatusAnual;
  motivo: string;
  qtd_reclamacoes: number;
  qtd_acoes_judiciais: number;
  numerador: number;
  total_ocorrencias: number;
  medida_sugerida: string | null;
  medida_codigo: string | null;
};

type Ocorrencia = { correspondente_id: string; mes_referencia?: string; responsavel: string | null; parecer: string | null };

export async function carregarClassificacoesAnuais(ano: number): Promise<ClassificacaoAnual[]> {
  const sb = await createClient();
  const ini = `${ano}-01-01`;
  const fim = `${ano}-12-31`;
  const [{ data: cors }, { data: rec }, { data: aj }, { data: ext }, { data: intern }, { data: gravadas }] =
    await Promise.all([
      sb.from("correspondentes").select("id, nome, cnpj").eq("ativo", true).order("nome"),
      sb.from("reclamacoes").select("correspondente_id, mes_referencia, responsavel, parecer").gte("mes_referencia", ini).lte("mes_referencia", fim),
      sb.from("acoes_judiciais").select("correspondente_id, mes_referencia, responsavel, parecer").gte("mes_referencia", ini).lte("mes_referencia", fim),
      sb.from("auditorias_externas").select("correspondente_id, pontuacao, data_avaliacao").gte("data_avaliacao", ini).lte("data_avaliacao", fim),
      sb.from("auditorias_internas").select("correspondente_id, pontuacao, data_avaliacao").gte("data_avaliacao", ini).lte("data_avaliacao", fim),
      sb.from("classificacoes_anuais").select("id, correspondente_id, ano_referencia, desvio_conduta_grave, status, pontuacao_geral"),
    ]);

  const porId = new Map((cors || []).map((c) => [c.id as string, c]));
  const recPor = new Map<string, Ocorrencia[]>();
  for (const r of (rec || []) as Ocorrencia[]) {
    const lista = recPor.get(r.correspondente_id) || [];
    lista.push(r);
    recPor.set(r.correspondente_id, lista);
  }
  const ajPor = new Map<string, Ocorrencia[]>();
  for (const r of (aj || []) as Ocorrencia[]) {
    const lista = ajPor.get(r.correspondente_id) || [];
    lista.push(r);
    ajPor.set(r.correspondente_id, lista);
  }
  const notasPor = new Map<string, number[]>();
  for (const a of [...(ext || []), ...(intern || [])]) {
    if (a.pontuacao == null) continue;
    const lista = notasPor.get(a.correspondente_id) || [];
    lista.push(Number(a.pontuacao));
    notasPor.set(a.correspondente_id, lista);
  }
  const gravadasPor = new Map<string, { id: string; desvio: boolean; hist: StatusAnual[] }>();
  const histPor = new Map<string, { ano: number; status: StatusAnual }[]>();
  for (const g of gravadas || []) {
    const cid = g.correspondente_id as string;
    const st = g.status as StatusAnual;
    const lista = histPor.get(cid) || [];
    lista.push({ ano: g.ano_referencia, status: st });
    histPor.set(cid, lista);
    if (g.ano_referencia === ano) {
      gravadasPor.set(cid, { id: g.id, desvio: Boolean(g.desvio_conduta_grave), hist: [] });
    }
  }

  const ids = new Set<string>([
    ...(cors || []).map((c) => c.id as string),
    ...recPor.keys(),
    ...ajPor.keys(),
    ...notasPor.keys(),
  ]);

  const saida: ClassificacaoAnual[] = [];
  for (const cid of ids) {
    const corr = porId.get(cid);
    const recC = recPor.get(cid) || [];
    const ajC = ajPor.get(cid) || [];
    const numerador =
      recC.filter((r) => eProcedenteCorban(r.responsavel, r.parecer)).length +
      ajC.filter((r) => eProcedenteCorban(r.responsavel, r.parecer)).length;
    const total = recC.length + ajC.length;
    const op = pontuacaoOperacional(numerador, total);
    const notas = notasPor.get(cid) || [];
    const qual = notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100 : null;
    const geral = pontuacaoGeral([op, qual]);
    const desvio = gravadasPor.get(cid)?.desvio ?? false;
    const resultado = classificarAnual({ pontuacaoGeral: geral, desvioCondutaGrave: desvio });
    const hist = (histPor.get(cid) || [])
      .filter((h) => h.ano < ano)
      .sort((a, b) => a.ano - b.ano)
      .map((h) => h.status);
    const medida = medidaSugeridaAnual(resultado.status, hist);
    saida.push({
      id: gravadasPor.get(cid)?.id || null,
      correspondente_id: cid,
      correspondente: corr?.nome || cid.slice(0, 8),
      cnpj: corr?.cnpj || "",
      ano,
      pontuacao_geral: resultado.pontuacao,
      pontuacao_operacional: op,
      pontuacao_qualitativa: qual,
      desvio_conduta_grave: desvio,
      status: resultado.status,
      motivo: resultado.motivo,
      qtd_reclamacoes: recC.length,
      qtd_acoes_judiciais: ajC.length,
      numerador,
      total_ocorrencias: total,
      medida_sugerida: medida?.rotulo || null,
      medida_codigo: medida?.codigo || null,
    });
  }
  return saida.sort((a, b) => a.correspondente.localeCompare(b.correspondente, "pt-BR"));
}

export function alertasAnuais(linhas: ClassificacaoAnual[]) {
  const saida: { correspondente: string; tipo: string; severidade: "critico" | "atencao" | "info"; mensagem: string }[] = [];
  for (const r of linhas) {
    if (r.status === "nao_conforme") {
      saida.push({
        correspondente: r.correspondente,
        tipo: "nao_conforme_anual",
        severidade: "critico",
        mensagem: `${r.correspondente} ficou não conforme no monitoramento anual (${r.motivo}).`,
      });
    } else if (r.status === "em_atencao") {
      saida.push({
        correspondente: r.correspondente,
        tipo: "em_atencao_anual",
        severidade: "atencao",
        mensagem: `${r.correspondente} ficou em atenção no monitoramento anual (${r.motivo}).`,
      });
    }
    if (r.desvio_conduta_grave) {
      saida.push({
        correspondente: r.correspondente,
        tipo: "desvio_grave",
        severidade: "critico",
        mensagem: `${r.correspondente} tem desvio de conduta grave registrado no ciclo ${r.ano}.`,
      });
    }
    if (r.medida_sugerida) {
      saida.push({
        correspondente: r.correspondente,
        tipo: "medida_anual",
        severidade: r.status === "nao_conforme" ? "critico" : "atencao",
        mensagem: `${r.correspondente}: medida sugerida do ciclo anual — ${r.medida_sugerida} (aplicação manual).`,
      });
    }
    if (r.status === "nao_aplicavel") {
      saida.push({
        correspondente: r.correspondente,
        tipo: "sem_avaliacao",
        severidade: "info",
        mensagem: `${r.correspondente} ainda sem pontuação anual (sem ocorrência no ano e sem auditoria).`,
      });
    }
  }
  const ordem: Record<string, number> = { critico: 0, atencao: 1, info: 2 };
  return saida.sort(
    (a, b) => (ordem[a.severidade] ?? 9) - (ordem[b.severidade] ?? 9) || a.correspondente.localeCompare(b.correspondente, "pt-BR"),
  );
}
