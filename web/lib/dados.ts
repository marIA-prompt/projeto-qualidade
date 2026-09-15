import { cache } from "react";
import { avaliarCorrespondente, type Alerta } from "./alertas";
import { mesIso } from "./format";
import { classificarMensal, eProcedenteCorban, eProcedenteSenff } from "./motor";
import { TIPOS_AUDITORIA } from "./pilares";
import { createClient } from "./supabase/server";
import type { Classificacao, Indefinido, Perfil, ResumoAuditoria } from "./types";

function moda(valores: (string | null | undefined)[]): string | null {
  const contagem = new Map<string, number>();
  for (const v of valores) {
    if (!v) continue;
    contagem.set(v, (contagem.get(v) || 0) + 1);
  }
  let melhor: string | null = null;
  let n = 0;
  for (const [k, c] of contagem) {
    if (c > n) {
      melhor = k;
      n = c;
    }
  }
  return melhor;
}

export const carregarPerfil = cache(async (): Promise<{
  userId: string;
  email: string;
  perfil: Perfil | null;
}> => {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  const { data } = await sb
    .from("perfis")
    .select("role, correspondente_id")
    .eq("id", user.id)
    .maybeSingle();
  return {
    userId: user.id,
    email: user.email || "",
    perfil: data as Perfil | null,
  };
});

export const carregarClassificacoes = cache(async (): Promise<Classificacao[]> => {
  const sb = await createClient();
  const { data: classifs } = await sb
    .from("classificacoes_mensais")
    .select("*, correspondentes(nome, cnpj)");
  const { data: rec } = await sb
    .from("reclamacoes")
    .select("correspondente_id, mes_referencia, responsavel, canal_origem");
  const { data: aj } = await sb
    .from("acoes_judiciais")
    .select("correspondente_id, mes_referencia, responsavel");

  const extra = new Map<
    string,
    {
      qtd_reclamacoes: number;
      qtd_acoes_judiciais: number;
      qtd_indefinidas: number;
      canais: (string | null)[];
    }
  >();
  const key = (cid: string, mes: string) => `${cid}|${mesIso(mes)}`;
  for (const r of rec || []) {
    const k = key(r.correspondente_id, r.mes_referencia);
    const cur = extra.get(k) || {
      qtd_reclamacoes: 0,
      qtd_acoes_judiciais: 0,
      qtd_indefinidas: 0,
      canais: [] as (string | null)[],
    };
    cur.qtd_reclamacoes += 1;
    if (r.responsavel === "indefinido") cur.qtd_indefinidas += 1;
    cur.canais.push(r.canal_origem);
    extra.set(k, cur);
  }
  for (const a of aj || []) {
    const k = key(a.correspondente_id, a.mes_referencia);
    const cur = extra.get(k) || {
      qtd_reclamacoes: 0,
      qtd_acoes_judiciais: 0,
      qtd_indefinidas: 0,
      canais: [] as (string | null)[],
    };
    cur.qtd_acoes_judiciais += 1;
    if (a.responsavel === "indefinido") cur.qtd_indefinidas += 1;
    extra.set(k, cur);
  }

  return (classifs || []).map((row) => {
    const mes = mesIso(row.mes_referencia);
    const c = extra.get(key(row.correspondente_id, mes));
    const corr = row.correspondentes as { nome?: string; cnpj?: string } | null;
    return {
      id: row.id,
      correspondente_id: row.correspondente_id,
      correspondente: corr?.nome || "—",
      cnpj: corr?.cnpj || "—",
      mes_referencia: mes,
      qtd_reclamacoes: c?.qtd_reclamacoes || 0,
      qtd_reclamacoes_corban: row.qtd_reclamacoes_corban || 0,
      qtd_acoes_judiciais: c?.qtd_acoes_judiciais || 0,
      qtd_acoes_judiciais_corban: row.qtd_acoes_judiciais_corban || 0,
      qtd_indefinidas: c?.qtd_indefinidas || 0,
      canal_mais_frequente: c ? moda(c.canais) : null,
      numerador: (row.qtd_reclamacoes_corban || 0) + (row.qtd_acoes_judiciais_corban || 0),
      carteira_denominador: row.carteira_denominador,
      indice: row.indice,
      status: row.status,
      aplicavel: Boolean(row.aplicavel),
    } satisfies Classificacao;
  });
});

export const resumoAuditorias = cache(async (): Promise<ResumoAuditoria[]> => {
  const sb = await createClient();
  const { data: cors } = await sb.from("correspondentes").select("id, nome, cnpj").order("nome");
  const saida: ResumoAuditoria[] = [];
  for (const tipo of Object.values(TIPOS_AUDITORIA)) {
    const { data: rows } = await sb
      .from(tipo.tabela)
      .select("correspondente_id, pilar, pontuacao, data_avaliacao");
    const byCorr = new Map<string, typeof rows>();
    for (const r of rows || []) {
      const list = byCorr.get(r.correspondente_id) || [];
      list.push(r);
      byCorr.set(r.correspondente_id, list);
    }
    for (const c of cors || []) {
      const recs = byCorr.get(c.id) || [];
      if (!recs.length) {
        saida.push({
          correspondente_id: c.id,
          correspondente: c.nome,
          cnpj: c.cnpj,
          tipo: tipo.rotulo,
          data: null,
          pilares: 0,
          media: null,
        });
        continue;
      }
      const ultima = recs.map((r) => r.data_avaliacao).sort().at(-1)!;
      const naData = recs.filter((r) => r.data_avaliacao === ultima);
      const notas = naData
        .map((r) => (r.pontuacao == null ? null : Number(r.pontuacao)))
        .filter((n): n is number => n != null);
      saida.push({
        correspondente_id: c.id,
        correspondente: c.nome,
        cnpj: c.cnpj,
        tipo: tipo.rotulo,
        data: ultima,
        pilares: new Set(naData.map((r) => r.pilar)).size,
        media: notas.length
          ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100
          : null,
      });
    }
  }
  return saida;
});

export function alertasDoMes(df: Classificacao[], resumo: ResumoAuditoria[], mes: string): Alerta[] {
  const extOk = new Set(
    resumo.filter((r) => r.tipo === "Auditoria externa" && r.data).map((r) => r.correspondente_id),
  );
  const intOk = new Set(
    resumo.filter((r) => r.tipo === "Auditoria interna" && r.data).map((r) => r.correspondente_id),
  );
  const saida: Alerta[] = [];
  for (const row of df) {
    saida.push(
      ...avaliarCorrespondente({
        correspondente_id: row.correspondente_id,
        correspondente: row.correspondente,
        mes_referencia: mes,
        status: row.status,
        indice: row.indice,
        qtd_reclamacoes: row.qtd_reclamacoes,
        qtd_indefinidas: row.qtd_indefinidas,
        canal_mais_frequente: row.canal_mais_frequente,
        tem_auditoria_externa: extOk.has(row.correspondente_id),
        tem_auditoria_interna: intOk.has(row.correspondente_id),
      }),
    );
  }
  const ordem: Record<string, number> = { critico: 0, atencao: 1, info: 2 };
  return saida.sort(
    (a, b) => (ordem[a.severidade] ?? 9) - (ordem[b.severidade] ?? 9) || a.correspondente.localeCompare(b.correspondente),
  );
}

export async function carregarIndefinidos(mes?: string | null): Promise<Indefinido[]> {
  const sb = await createClient();
  const linhas: Indefinido[] = [];
  const ids = new Set<string>();
  const alvo = mes ? mesIso(mes) : null;

  let recQ = sb
    .from("reclamacoes")
    .select("id, correspondente_id, protocolo, mes_referencia, data_encerramento, parecer, canal_origem")
    .eq("responsavel", "indefinido")
    .order("mes_referencia", { ascending: false });
  if (alvo) recQ = recQ.eq("mes_referencia", alvo);
  const rec = (await recQ).data || [];

  let ajQ = sb
    .from("acoes_judiciais")
    .select("id, correspondente_id, protocolo, mes_referencia, data_encerramento, parecer")
    .eq("responsavel", "indefinido")
    .order("mes_referencia", { ascending: false });
  if (alvo) ajQ = ajQ.eq("mes_referencia", alvo);
  const aj = (await ajQ).data || [];

  for (const row of rec) {
    if (row.correspondente_id) ids.add(row.correspondente_id);
    linhas.push({
      tabela: "reclamacoes",
      id: row.id,
      correspondente_id: row.correspondente_id,
      correspondente: "",
      protocolo: row.protocolo || "—",
      ano_mes: mesIso(row.mes_referencia),
      encerrado_em: row.data_encerramento,
      canal: row.canal_origem || "—",
      parecer: row.parecer,
      fonte: "reclamações",
    });
  }
  for (const row of aj) {
    if (row.correspondente_id) ids.add(row.correspondente_id);
    linhas.push({
      tabela: "acoes_judiciais",
      id: row.id,
      correspondente_id: row.correspondente_id,
      correspondente: "",
      protocolo: row.protocolo || "—",
      ano_mes: mesIso(row.mes_referencia),
      encerrado_em: row.data_encerramento,
      canal: "—",
      parecer: row.parecer,
      fonte: "ações judiciais",
    });
  }
  if (ids.size) {
    const { data: cors } = await sb.from("correspondentes").select("id, nome").in("id", [...ids]);
    const mapa = new Map((cors || []).map((c) => [c.id, c.nome as string]));
    for (const row of linhas) {
      row.correspondente =
        (row.correspondente_id && mapa.get(row.correspondente_id)) ||
        row.correspondente_id?.slice(0, 8) ||
        "—";
    }
  }
  return linhas;
}

export async function reclassificarMes(mes: string): Promise<number> {
  const sb = await createClient();
  const mesIsoDate = mesIso(mes);
  const { data: rec } = await sb
    .from("reclamacoes")
    .select("correspondente_id, responsavel, parecer")
    .eq("mes_referencia", mesIsoDate);
  const { data: aj } = await sb
    .from("acoes_judiciais")
    .select("correspondente_id, responsavel, parecer")
    .eq("mes_referencia", mesIsoDate);
  const { data: carteiras } = await sb
    .from("carteira_produzida")
    .select("correspondente_id, operacoes_acumuladas_desde_2023")
    .eq("mes_referencia", mesIsoDate);
  const carteiraPorId = new Map<string, number>();
  for (const c of carteiras || []) {
    if (c.operacoes_acumuladas_desde_2023 != null) {
      carteiraPorId.set(c.correspondente_id, c.operacoes_acumuladas_desde_2023);
    }
  }
  const ids = new Set<string>([
    ...(rec || []).map((r) => r.correspondente_id),
    ...(aj || []).map((a) => a.correspondente_id),
    ...carteiraPorId.keys(),
  ]);
  const classificacoes = [...ids].map((corrId) => {
    const recC = (rec || []).filter((r) => r.correspondente_id === corrId);
    const ajC = (aj || []).filter((a) => a.correspondente_id === corrId);
    const rpc = recC.filter((r) => eProcedenteCorban(r.responsavel, r.parecer)).length;
    const apc = ajC.filter((a) => eProcedenteCorban(a.responsavel, a.parecer)).length;
    const indefinidas =
      recC.filter((r) => r.responsavel === "indefinido").length +
      ajC.filter((a) => a.responsavel === "indefinido").length;
    const resultado = classificarMensal({
      reclamacoes_procedentes_corban: rpc,
      acoes_judiciais_procedentes_corban: apc,
      total_reclamacoes_mes: recC.length,
      carteira_produzida: carteiraPorId.has(corrId) ? carteiraPorId.get(corrId)! : null,
      pendentes_indefinido: indefinidas,
    });
    return {
      correspondente_id: corrId,
      mes_referencia: mesIsoDate,
      qtd_reclamacoes_corban: rpc,
      qtd_acoes_judiciais_corban: apc,
      carteira_denominador: resultado.denominador,
      indice: resultado.indice,
      aplicavel: resultado.aplicavel,
      status: resultado.status,
    };
  });
  if (classificacoes.length) {
    await sb.from("classificacoes_mensais").upsert(classificacoes, {
      onConflict: "correspondente_id,mes_referencia",
    });
  }
  return classificacoes.length;
}

export function montarLinhasExport(df: Classificacao[], rec: { correspondente_id: string; responsavel: string; parecer: string | null }[], aj: { correspondente_id: string; responsavel: string; parecer: string | null }[]) {
  return df.map((row) => {
    const r = rec.filter((x) => x.correspondente_id === row.correspondente_id);
    const a = aj.filter((x) => x.correspondente_id === row.correspondente_id);
    return {
      mes_referencia: mesRotuloSafe(row.mes_referencia),
      cnpj_correspondente: row.cnpj,
      nome_correspondente: row.correspondente,
      qtd_reclamacoes_total: r.length,
      qtd_reclamacoes_procedentes_corban: r.filter((x) => eProcedenteCorban(x.responsavel, x.parecer)).length,
      qtd_reclamacoes_procedentes_senff: r.filter((x) => eProcedenteSenff(x.responsavel, x.parecer)).length,
      qtd_reclamacoes_indefinidas: r.filter((x) => x.responsavel === "indefinido").length,
      qtd_acoes_judiciais_total: a.length,
      qtd_acoes_judiciais_procedentes_corban: a.filter((x) => eProcedenteCorban(x.responsavel, x.parecer)).length,
      qtd_acoes_judiciais_procedentes_senff: a.filter((x) => eProcedenteSenff(x.responsavel, x.parecer)).length,
      qtd_acoes_judiciais_indefinidas: a.filter((x) => x.responsavel === "indefinido").length,
      canal_mais_frequente: row.canal_mais_frequente || "",
      numerador_indice_quadro5: row.numerador,
      carteira_denominador: row.carteira_denominador,
      indice: row.indice,
      status: row.status,
    };
  });
}

function mesRotuloSafe(v: string) {
  return v.slice(0, 7);
}
