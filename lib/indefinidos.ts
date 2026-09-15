export function sufixoConfirmacao(
  parecer: string | null | undefined,
  destino: "corban" | "senff",
  hoje = new Date(),
): string {
  const dia = hoje.toISOString().slice(0, 10);
  const extra = `[V1: confirmado ${destino} em ${dia}]`;
  const base = (parecer || "").trim();
  if (base.includes(extra)) return base;
  if (!base) return extra;
  return `${base} ${extra}`;
}

export function payloadConfirmacao(
  parecer: string | null | undefined,
  destino: "corban" | "senff",
  hoje?: Date,
) {
  return {
    responsavel: destino,
    parecer: sufixoConfirmacao(parecer, destino, hoje),
  };
}

export function logConfirmacao(args: {
  tabela: string;
  registro_id: string;
  destino: "corban" | "senff";
  usuario_id: string | null;
  parecer_anterior: string | null;
  parecer_novo: string;
}) {
  return {
    tabela_afetada: args.tabela,
    registro_id: args.registro_id,
    operacao: "update",
    dados_antigos: { responsavel: "indefinido", parecer: args.parecer_anterior },
    dados_novos: { responsavel: args.destino, parecer: args.parecer_novo },
    usuario_id: args.usuario_id,
  };
}
