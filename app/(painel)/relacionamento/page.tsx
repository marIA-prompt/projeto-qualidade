import { Tabela } from "@/components/ui";
import { acaoRelacionamento } from "@/lib/alertas";
import { contextoPainel } from "@/lib/contexto";
import { PILARES, SUBCRITERIOS } from "@/lib/pilares";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const { df, alertas } = await contextoPainel(mes);
  const rel = alertas.filter((a) =>
    ["relacionamento", "volume_reclamacoes", "nao_conforme"].includes(a.tipo),
  );
  const ranking = [...df]
    .sort((a, b) => b.qtd_reclamacoes - a.qtd_reclamacoes)
    .slice(0, 10)
    .map((r) => ({
      c: r.correspondente,
      cnpj: r.cnpj,
      rec: r.qtd_reclamacoes,
      canal: r.canal_mais_frequente || "—",
      status: r.status,
      passo: acaoRelacionamento(alertas.filter((a) => a.correspondente === r.correspondente)),
    }));

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Vertente de relacionamento</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        Qualidade de Correspondentes não é só índice e sanção. O pilar{" "}
        <strong>{PILARES.relacionamento_cliente}</strong> avalia clareza, linguagem, atendimento,
        respeito ao consumidor e oferta responsável. A conversa vem antes da medida punitiva.
      </p>
      <ul className="list-disc pl-5 text-sm">
        {Object.values(SUBCRITERIOS.relacionamento_cliente).map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <h3 className="font-semibold">Onde o relacionamento pede conversa neste mês</h3>
      {rel.length ? (
        <Tabela
          colunas={[
            { chave: "c", titulo: "Correspondente" },
            { chave: "m", titulo: "Mensagem" },
          ]}
          linhas={rel.map((a) => ({ c: a.correspondente, m: a.mensagem }))}
        />
      ) : (
        <p>Nenhum correspondente com alerta de relacionamento neste mês.</p>
      )}
      <h3 className="font-semibold">Fila de acompanhamento (top 10 em reclamações)</h3>
      <Tabela
        colunas={[
          { chave: "c", titulo: "Correspondente" },
          { chave: "cnpj", titulo: "CNPJ" },
          { chave: "rec", titulo: "Reclamações" },
          { chave: "canal", titulo: "Canal" },
          { chave: "status", titulo: "Status" },
          { chave: "passo", titulo: "Próximo passo" },
        ]}
        linhas={ranking}
      />
      <p className="rounded-[var(--radius-box)] bg-[#e8f4fc] p-3 text-sm">
        Medidas discricionárias já cadastradas: reorientação de conduta e notificação. Suspensão
        permanece decisão da Gestora — nunca automática.
      </p>
    </section>
  );
}
