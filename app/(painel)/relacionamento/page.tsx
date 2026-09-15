import { CampoAcaoRealizada, CampoDataAcao } from "@/components/CamposAcompanhamento";
import { Tabela } from "@/components/ui";
import { acaoRelacionamento } from "@/lib/alertas";
import { contextoPainel } from "@/lib/contexto";
import { CHAVE_ACOMPANHAMENTO_FILA, chaveAcompanhamentoConversa } from "@/lib/filtros";
import { PILARES, SUBCRITERIOS } from "@/lib/pilares";
import { createClient } from "@/lib/supabase/server";

type AcaoSalva = { acao_realizada: boolean; data_acao: string | null };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; corban?: string }>;
}) {
  const { mes, corban: corbanParam } = await searchParams;
  const { df, alertas, mes: mesAtual, perfil } = await contextoPainel(mes, corbanParam);
  const ehStaff = perfil?.role === "staff";
  const sb = await createClient();
  const { data: salvas } = await sb
    .from("acompanhamento_acoes")
    .select("correspondente_id, chave, acao_realizada, data_acao")
    .eq("mes_referencia", mesAtual);
  const mapa = new Map<string, AcaoSalva>();
  for (const s of salvas || []) {
    mapa.set(`${s.correspondente_id}|${s.chave}`, {
      acao_realizada: Boolean(s.acao_realizada),
      data_acao: s.data_acao || null,
    });
  }
  function campos(correspondenteId: string, chave: string) {
    const atual = mapa.get(`${correspondenteId}|${chave}`);
    return {
      acao: (
        <CampoAcaoRealizada
          correspondenteId={correspondenteId}
          mes={mesAtual}
          chave={chave}
          inicial={Boolean(atual?.acao_realizada)}
          ehStaff={Boolean(ehStaff)}
        />
      ),
      data: (
        <CampoDataAcao
          key={atual?.data_acao || "vazio"}
          correspondenteId={correspondenteId}
          mes={mesAtual}
          chave={chave}
          inicial={atual?.data_acao || null}
          ehStaff={Boolean(ehStaff)}
        />
      ),
    };
  }

  const rel = alertas.filter((a) =>
    ["relacionamento", "volume_reclamacoes", "nao_conforme"].includes(a.tipo),
  );
  const ranking = [...df]
    .sort((a, b) => b.qtd_reclamacoes - a.qtd_reclamacoes)
    .slice(0, 10)
    .map((r) => {
      const chave = CHAVE_ACOMPANHAMENTO_FILA;
      const feito = campos(r.correspondente_id, chave);
      return {
        c: r.correspondente,
        cnpj: r.cnpj,
        rec: r.qtd_reclamacoes,
        canal: r.canal_mais_frequente || "—",
        status: r.status,
        passo: acaoRelacionamento(alertas.filter((a) => a.correspondente_id === r.correspondente_id)),
        acao: feito.acao,
        data: feito.data,
      };
    });

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Vertente de relacionamento</h2>
      <p className="text-sm text-[var(--senff-navy-text)]">
        Qualidade de Correspondentes não é só índice e sanção. O pilar{" "}
        <strong>{PILARES.relacionamento_cliente}</strong> avalia clareza, linguagem, atendimento,
        respeito ao consumidor e oferta responsável. A conversa vem antes da medida punitiva.
        Marque a ação realizada e a data aqui; a medida formal continua em Medidas administrativas.
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
            { chave: "acao", titulo: "Ação realizada" },
            { chave: "data", titulo: "Data" },
          ]}
          linhas={rel.map((a) => {
            const feito = campos(a.correspondente_id, chaveAcompanhamentoConversa(a.tipo));
            return {
              c: a.correspondente,
              m: a.mensagem,
              acao: feito.acao,
              data: feito.data,
            };
          })}
        />
      ) : (
        <p>Nenhum correspondente com conversa de relacionamento em aberto neste mês.</p>
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
          { chave: "acao", titulo: "Ação realizada" },
          { chave: "data", titulo: "Data" },
        ]}
        linhas={ranking}
      />
    </section>
  );
}
