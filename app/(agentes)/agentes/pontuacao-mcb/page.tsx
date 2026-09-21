import { Chip, Kpis, Tabela } from "@/components/ui";
import { contextoAgentes } from "@/lib/agentes/contexto";

export default async function PontuacaoMcbPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cpf?: string }>;
}) {
  const { mes, cpf } = await searchParams;
  const ctx = await contextoAgentes(mes, cpf);
  const lista = ctx.mcb;
  const comPontos = lista.filter((m) => m.pontos_vigentes > 0).length;
  const temp = lista.filter((m) => m.suspensao === "temporaria").length;
  const def = lista.filter((m) => m.suspensao === "definitiva").length;

  return (
    <section className="space-y-4">
      <p className="text-sm text-[var(--senff-navy-text)]">
        Consequência do NC do Quadro 6 — <strong>não</strong> é advertência nem
        suspensão de 10 dias do correspondente. NC no mês base = <strong>5
        pontos</strong>; cada pontuação vale <strong>12 meses</strong>;{" "}
        <strong>20 pontos em 12 meses</strong> → suspensão temporária de 12
        meses consecutivos; ao término a pontuação zera; reincidência →
        suspensão definitiva.
      </p>
      <Kpis
        cards={[
          { label: "Agentes acompanhados", value: String(lista.length), tone: "acqua" },
          { label: "Com pontos vigentes", value: String(comPontos), hint: "5 por mês NC", tone: "navy" },
          { label: "Suspensão temporária", value: String(temp), tone: "sky" },
          { label: "Suspensão definitiva", value: String(def), tone: "warn" },
        ]}
      />
      {!comPontos ? (
        <p className="rounded-[var(--radius-box)] border border-[#E7C878] bg-[#FBF3DF] p-3 text-sm text-[#8A6410]">
          Nenhuma pontuação MCB neste recorte: não houve mês classificado como
          Não conforme. Sem carteira do agente o Quadro 6 permanece não
          aplicável e não gera os 5 pontos.
        </p>
      ) : null}
      <Tabela
        colunas={[
          { chave: "nome", titulo: "Agente" },
          { chave: "cpf", titulo: "CPF" },
          { chave: "pts", titulo: "Pontos vigentes" },
          { chave: "susp", titulo: "Suspensão" },
          { chave: "motivo", titulo: "Motivo" },
        ]}
        linhas={lista.map((m) => ({
          nome: m.nome_agente || m.cpf_agente_mascarado,
          cpf: m.cpf_agente_mascarado,
          pts: m.pontos_vigentes,
          susp: m.suspensao ? <Chip status={m.suspensao} /> : "—",
          motivo: m.motivo,
        }))}
      />
    </section>
  );
}
