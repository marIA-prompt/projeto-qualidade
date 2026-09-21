import { FormAuditoriaAgente } from "@/components/agentes/FormAuditoriaAgente";
import { Tabela } from "@/components/ui";
import { carregarAuditoriasAgente } from "@/lib/agentes/auditorias";
import { contextoAgentes } from "@/lib/agentes/contexto";
import { mascararCpf } from "@/lib/agentes/format";
import { PILARES } from "@/lib/pilares";

export default async function AuditoriasAgentesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cpf?: string }>;
}) {
  const { mes, cpf } = await searchParams;
  const ctx = await contextoAgentes(mes, cpf);
  let blocos = carregarAuditoriasAgente();
  if (ctx.cpf) blocos = blocos.filter((a) => a.cpf_agente === ctx.cpf);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Auditorias</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        Registro operacional por CPF. Não altera o índice do Quadro 6 nem a pontuação MCB.
        Não grava nas tabelas de correspondente.
      </p>
      {ctx.role === "staff" ? (
        <FormAuditoriaAgente agentes={ctx.agentes} cpfInicial={ctx.cpf} />
      ) : (
        <p className="text-sm">Somente a área de Qualidade registra auditorias.</p>
      )}
      <h3 className="font-semibold">Últimos registros</h3>
      {blocos.length ? (
        <Tabela
          colunas={[
            { chave: "Tipo", titulo: "Tipo" },
            { chave: "Data", titulo: "Data" },
            { chave: "Agente", titulo: "Agente" },
            { chave: "Cpf", titulo: "CPF" },
            { chave: "Pilar", titulo: "Pilar" },
            { chave: "Pontuação", titulo: "Pontuação" },
            { chave: "Observações", titulo: "Observações" },
          ]}
          linhas={blocos.map((r) => ({
            Tipo: r.tipo === "interna" ? "Auditoria interna" : "Auditoria externa",
            Data: r.data_avaliacao,
            Agente: r.nome_agente || mascararCpf(r.cpf_agente),
            Cpf: mascararCpf(r.cpf_agente),
            Pilar: PILARES[r.pilar] || r.pilar,
            Pontuação: r.pontuacao ?? "—",
            Observações: r.observacoes || "—",
          }))}
        />
      ) : (
        <p className="text-sm">Nenhuma auditoria registrada ainda.</p>
      )}
    </section>
  );
}
