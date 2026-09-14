# Decisões de negócio e regras validadas

Registro auditável das regras implementadas e de como foram validadas.
Última atualização: 14/09/2026 (entrega da V1 — Fase 1).

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
| 4 | **Unitariedade** (art. 9º): mesmo contrato em múltiplos canais conta uma vez, deduplicando **dentro do mesmo tipo** de ocorrência. Reclamação e ação judicial do mesmo contrato contam separadas (indicadores distintos). | O fechamento real de agosto conta as duas pontas do caso do contrato 2025020201722 (1 reclamação Procon + 1 ação judicial). A linha duplicada é mantida no banco com a flag `duplicada_unitariedade` para rastreabilidade. |
| 5 | `tipo_ocorrencia_mais_frequente` considera **apenas reclamações** (tipo 4), não ações judiciais. | Única combinação que reproduz as 25 linhas do fechamento real. |
| 6 | `qtd_encaminhadas_fraudes` conta as ocorrências encerradas no mês (base cruzada e deduplicada) com `Encaminhou ao Fraudes` preenchido — e não o total do export normal. | Única base que reproduz o fechamento real (19 vs 22 no caso CONECT, por exemplo). |

## 2. Decisões de arquitetura da V1

- **Base motriz do mês é o export detalhado** (encerradas no mês); o export
  normal enriquece com atribuição, contrato, canal e cliente.
- **Recarga idempotente**: o ETL apaga e regrava as ocorrências do
  `mes_referencia` processado; a trilha em `log_alteracoes` preserva o histórico.
- **Duplicadas não são descartadas**: ficam gravadas com
  `duplicada_unitariedade = true` e fora das agregações (rastreabilidade até o
  dado bruto — exigência de auditabilidade).
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

## 3. Pontos em aberto (não bloqueiam a V1, mas precisam de resposta da área)

1. **Fonte da carteira produzida por correspondente** (denominador do Quadro 5)
   — provavelmente o sistema de originação, não o navigate. Até lá: planilha
   manual em `carteira_produzida`.
2. **Casos "indefinidos"** (~25%/mês): acumular exports normais de meses
   anteriores para cruzar retroativamente, ou pedir a coluna de atribuição no
   export detalhado do navigate?
3. **Corte "≥ 3 reclamações/mês"**: confirmar se considera o total de
   reclamações recebidas ou apenas procedentes (implementado: total).
4. **Limiar interno de alerta** mais conservador que o regulatório (ex.: 80%
   do limite) — relevante para a Fase 3 (alertas automatizados).
5. **Critério de escolha entre os 6 níveis de medida administrativa** — hoje é
   decisão caso a caso da Gestora de Qualidade; o sistema apenas registra.
