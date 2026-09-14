# Decisões de negócio e regras validadas

Registro auditável das regras implementadas e de como foram validadas.
Última atualização: 14/09/2026 (código alinhado ao schema V1 já aplicado no Supabase).

## 1. Regras do ETL validadas com o fechamento real de agosto/2026

O agregado produzido pelo ETL foi comparado **campo a campo** com o fechamento
oficial de agosto/2026 preparado pela analista
(`agregado_mensal_correspondentes_2026-08.csv`, 25 correspondentes): todos os
contadores (totais, procedentes-Corban, procedentes-Senff, indefinidas,
numerador do Quadro 5), o tipo de ocorrência mais frequente e a contagem de
encaminhamentos a Fraudes bateram 100%.

| # | Regra | Como foi validada |
|---|---|---|
| 1 | `Tipo de Ocorrência` (export detalhado) é binário: `1` = ação judicial, `4` = reclamação. Mapeia 1:1 com `Setor Origem`. | 100% de correspondência nos 197 registros cruzados de agosto. |
| 2 | A atribuição de responsabilidade vem **somente** do `Parecer` do export normal (`... - Corban` / `... - Senff`). O parecer da detalhada só diz procedente/improcedente. | Em agosto, dos "Procedente" da detalhada, 8 eram Corban e 4 eram Senff — usar só a detalhada atribuiria culpa errada. |
| 3 | Registros da detalhada sem par na normal do mês (`Identificador da ocorrência` ∉ `Protocolo`) ficam `responsavel = 'indefinido'` e **não entram no índice**. | 66 de 263 registros (25,1%) em agosto — casos abertos em meses anteriores e encerrados no mês. |
| 4 | **Unitariedade** (art. 9º): mesmo contrato em múltiplos canais conta uma vez, deduplicando **dentro do mesmo tipo** de ocorrência. Reclamação e ação judicial do mesmo contrato contam separadas (indicadores distintos). | O fechamento real de agosto conta as duas pontas do caso do contrato 2025020201722 (1 reclamação Procon + 1 ação judicial). A linha duplicada é marcada no CSV de `--dry-run` e **não é gravada** no banco (o schema V1 não tem flag `duplicada_unitariedade`). |
| 5 | `tipo_ocorrencia_mais_frequente` considera **apenas reclamações** (tipo 4), não ações judiciais. | Única combinação que reproduz as 25 linhas do fechamento real. |
| 6 | `qtd_encaminhadas_fraudes` conta as ocorrências encerradas no mês (base cruzada e deduplicada) com `Encaminhou ao Fraudes` preenchido — e não o total do export normal. | Única base que reproduz o fechamento real (19 vs 22 no caso CONECT, por exemplo). |

## 2. Decisões de arquitetura da V1

- **Base motriz do mês é o export detalhado** (encerradas no mês); o export
  normal enriquece com atribuição, contrato, canal e cliente.
- **Recarga idempotente**: o ETL apaga e regrava as ocorrências do
  `mes_referencia` processado. O schema em produção não tem trigger em
  `log_alteracoes`; a tabela existe para a Fase 2.
- **Duplicadas de unitariedade não são gravadas**: o schema V1 não tem a
  coluna `duplicada_unitariedade`, então inseri-las poluiria as contagens.
  O CSV de `--dry-run` as mantém marcadas para rastreabilidade.
- **Mapeamento para o schema já aplicado no Supabase** (não recriar tabelas):
  - `perfis.id` = `auth.uid()`, `perfis.role` (não `user_id`/`papel`).
  - `reclamacoes`/`acoes_judiciais`: `protocolo` = Identificador da ocorrência;
    `parecer` = parecer detalhado (Corban/Senff) quando houver par, senão o
    binário da detalhada; `origem_export` = `'detalhada'` (base motriz);
    `acoes_judiciais` não tem `canal_origem`.
  - `classificacoes_mensais` guarda só o numerador Corban, `carteira_denominador`,
    `indice`, `aplicavel` e `status`. Totais, indefinidas e canal mais frequente
    o dashboard deriva das tabelas de ocorrência.
  - Denominador: `carteira_produzida.operacoes_acumuladas_desde_2023`.
  - `medidas_aplicadas.data_aplicacao` / `aplicada_por` / `classificacao_mensal_id`
    (sem `mes_referencia`). Lookup tem 6 níveis + 4 medidas discricionárias.
- **Canal mais frequente no painel** (não "Tipo Reclamação" do navigate): o
  schema V1 não tem coluna `tipo_reclamacao`; o mais próximo é `canal_origem`
  (Setor Origem).
- **Denominador (carteira produzida)**: fonte oficial ainda não confirmada
  (não vem do navigate). A tabela `carteira_produzida` aceita carga manual;
  sem linha para o correspondente/mês o motor devolve `nao_aplicavel` — nunca
  assume zero.
- **Corte de aplicabilidade "≥ 3 reclamações/mês"** foi interpretado como o
  total de reclamações do mês (independente de parecer), não apenas as
  procedentes. ⚠️ Confirmar com a área.
- **Limite inclusivo**: índice exatamente igual a 0,03% classifica como
  `nao_conforme` (regra "≥ 0,03%").
- **Chaves**: ETL usa `service_role` (bypassa RLS, roda sem usuário logado);
  dashboard usa `anon key` + token do usuário (RLS ativo). LGPD: nome/CPF de
  cliente não são exibidos no painel.
- **Funções `eh_staff()` / `meu_correspondente_id()`** são `SECURITY DEFINER`
  com `search_path = public`. Sem isso, a policy de `perfis` chama `eh_staff()`
  que lê `perfis` de novo e o Postgres estoura `stack depth limit exceeded`.
  Patch: `docs/sql/eh_staff_security_definer.sql` (já aplicado no projeto).

## 3. Pontos em aberto (não bloqueiam a V1, mas precisam de resposta da área)

1. **Fonte da carteira produzida por correspondente** (denominador do Quadro 5)
   — provavelmente o sistema de originação, não o navigate. Até lá: planilha
   manual via `etl/etl_carteira.py` (modelo em `etl/modelo_carteira_produzida.csv`).
2. **Casos "indefinidos"** (~25%/mês): acumular exports normais de meses
   anteriores para cruzar retroativamente, ou pedir a coluna de atribuição no
   export detalhado do navigate?
3. **Corte "≥ 3 reclamações/mês"**: confirmar se considera o total de
   reclamações recebidas ou apenas procedentes (implementado: total).
4. **Limiar interno de alerta** — implementado em 80% do teto de 0,03%
   (`LIMIAR_ALERTA_INTERNO`), junto com volume ≥ 3 reclamações/mês, indefinidas
   e auditoria pendente. Recalculado a cada abertura do painel (aba Alertas).
   O e-mail SMTP dispara o relatório mensal quando `SMTP_*` estiver no .env.
5. **Critério de escolha entre os 6 níveis de medida administrativa** — hoje é
   decisão caso a caso da Gestora de Qualidade; o sistema apenas registra.
   A aba Relacionamento prioriza conversa / reorientação / notificação.
6. **Pontuação de pilar (FR-3)** — média simples dos subcritérios avaliados
   (ok=100, parcial=50, nao_ok=0). Não substitui o Quadro 3 anual até a área
   validar limiares e o cruzamento com desvio de conduta grave.
7. **Carteira produzida** — a área adiou a planilha completa; o status mensal
   permanece `nao_aplicavel` até haver denominador.
8. **Visual do painel** — tokens no padrão Pulso (espaçamento pulse, radius,
   papéis semânticos); primitivas de cor da identidade Banco Senff
   (`#112369` navy, `#05AACA` acqua, Readex Pro). O Pulso público da RD Saúde
   é multi-marca; o tema Senff ocupa o mesmo papel que Raia/Drogasil ocupam
   lá. Se a área tiver um arquivo Figma interno do Pulso Senff, substituímos
   as primitivas.
9. **Login staff do painel** — `maria.morais@senff.com.br`.
10. **Requisitos Bruna Camargo** no painel: visão por correspondente, alertas
    automatizados nas métricas, relatório mensal (download + SMTP) e vertente
    de relacionamento (pilar + fila de acompanhamento).
