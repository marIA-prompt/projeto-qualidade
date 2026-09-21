import { carregarPerfil } from "@/lib/dados";
import { agentesUnicos, type AgenteOpcao } from "./filtros";
import { mesChave } from "./format";
import {
  carregarSnapshot,
  filtrarMes,
  mesesDoSnapshot,
  type Classificacao,
  type Fraude104,
  type Ocorrencia,
  type PontuacaoMcb,
  type Snapshot,
} from "./snapshot";

export type ContextoAgentes = {
  email: string;
  role: string;
  snap: Snapshot;
  mes: string;
  meses: string[];
  cpf: string | null;
  agentes: AgenteOpcao[];
  df: Classificacao[];
  ocorrencias: Ocorrencia[];
  mcb: PontuacaoMcb[];
  fraude: Fraude104[];
};

export async function contextoAgentes(mes?: string, cpf?: string): Promise<ContextoAgentes> {
  const sessao = await carregarPerfil();
  const snap = carregarSnapshot();
  const meses = mesesDoSnapshot(snap);
  const mesAtual = mesChave(mes || meses[0] || "");
  const cpfFiltro = cpf || null;
  let df = filtrarMes(snap.classificacoes, mesAtual);
  if (cpfFiltro) df = df.filter((l) => l.cpf_agente === cpfFiltro);
  const ocorrencias = snap.ocorrencias.filter((o) => {
    if (mesAtual && mesChave(o.mes_referencia) !== mesAtual) return false;
    if (cpfFiltro && o.cpf_agente !== cpfFiltro) return false;
    return true;
  });
  const mcb = cpfFiltro
    ? snap.pontuacoes_mcb.filter((m) => m.cpf_agente === cpfFiltro)
    : snap.pontuacoes_mcb;
  const fraude = cpfFiltro ? snap.fraude_104.filter((f) => f.cpf_agente === cpfFiltro) : snap.fraude_104;
  return {
    email: sessao.email,
    role: sessao.perfil?.role || "",
    snap,
    mes: mesAtual,
    meses,
    cpf: cpfFiltro,
    agentes: agentesUnicos(snap.classificacoes),
    df,
    ocorrencias,
    mcb,
    fraude,
  };
}
