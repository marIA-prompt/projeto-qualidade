"use client";

import { useRouter } from "next/navigation";
import { Chip, Tabela } from "@/components/ui";
import { queryPainel } from "@/lib/agentes/filtros";
import { fmtIndice } from "@/lib/agentes/format";

export function TabelaQuadro6({
  mes,
  linhas,
}: {
  mes: string;
  linhas: {
    cpf: string;
    nome: string;
    mascara: string;
    corban: string;
    rec: number;
    aj: number;
    num: number;
    cart: string | number;
    idx: number | null;
    status: string;
  }[];
}) {
  const router = useRouter();
  return (
    <Tabela
      colunas={[
        { chave: "nome", titulo: "Agente" },
        { chave: "mascara", titulo: "CPF" },
        { chave: "corban", titulo: "Correspondente (vínculo)" },
        { chave: "rec", titulo: "Reclamações" },
        { chave: "aj", titulo: "Ações" },
        { chave: "num", titulo: "Numerador" },
        { chave: "cart", titulo: "Carteira" },
        { chave: "idx", titulo: "Índice" },
        { chave: "st", titulo: "Status" },
      ]}
      linhas={linhas.map((r) => ({
        cpf: r.cpf,
        nome: r.nome,
        mascara: r.mascara,
        corban: r.corban,
        rec: r.rec,
        aj: r.aj,
        num: r.num,
        cart: r.cart,
        idx: fmtIndice(r.idx),
        st: <Chip status={r.status} />,
      }))}
      onLinha={(row) => {
        router.push(`/agentes/agente${queryPainel({ mes, cpf: String(row.cpf) })}`);
      }}
    />
  );
}
