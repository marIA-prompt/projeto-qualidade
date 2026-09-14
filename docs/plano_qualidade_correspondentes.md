# Plano de Qualidade de Correspondentes — Resumo Executivo (V1)

> Fonte: briefing interno de Compliance (v1.1, 14/09/2026), Normativo Correlato
> da Autorregulação do Crédito Consignado (vigente desde 20/03/2026, alterado
> pelas Deliberações nº 01/2026 e nº 02/2026) e respectivo Anexo I. Os PDFs
> originais não são versionados aqui (uso interno); este documento existe para
> dar contexto suficiente ao trabalho no Cursor sem precisar reabri-los.

## 1. Por que este sistema existe

O Banco Senff, como Participante da Autorregulação do Crédito Consignado
(FEBRABAN), é obrigado (arts. 50–55 do Normativo Correlato e art. 5º do Anexo
I) a manter um **Plano de Qualidade** que monitore seus correspondentes por
meio de 4 indicadores segregados e rastreáveis:

1. **Reclamações** (procedência vs. volume de produção)
2. **Ações Judiciais**
3. **Auditorias Externas**
4. **Auditorias Internas**

O resultado mensal (volumetria de reclamações/ações procedentes + carteira
produzida) precisa ser enviado ao **MCB** até o **dia 25** do mês subsequente
(art. 69).

Hoje esse processo é 100% manual (export do navigate → Excel → MCB), o que já
gerou críticas em testes de efetividade de auditoria por falta de indicadores
segregados e rastreáveis, e depende de um único analista.

## 2. Base legal essencial para a V1

- **Art. 51, II** — o que conta como reclamação/ação judicial procedente para
  fins do Plano de Qualidade: oferta abusiva relacionada ao Não me Perturbe,
  irregularidade na formalização, ausência de anuência do consumidor,
  obstrução ao direito de arrependimento.
- **Art. 53** — só é "procedente" para fins do índice quando a
  **responsabilidade é do correspondente (Corban)**. Se a responsabilidade for
  do próprio Participante (Senff), **não conta** contra o correspondente.
- **Art. 69** — o envio mensal ao MCB inclui (I) a volumetria de contratos
  produzidos pelo correspondente desde jan/2023 e (II) as reclamações/ações
  procedentes do mês, tendo como referência essa mesma carteira — **mesmo
  quando o número de reclamações for zero**.
- **Art. 70** — indícios de golpe/fraude/falsidade ideológica exigem retenção
  documental de, no mínimo, **5 anos**.
- **Anexo I, art. 9º (Quadro 5)** — monitoramento mensal:
  - índice = (reclamações + ações judiciais procedentes-Corban no mês) ÷
    (carteira produzida desde jan/2023);
  - ocorrências do mesmo contrato em múltiplos canais contam uma única vez
    (unitariedade);
  - aplicável apenas a correspondentes com **> 3.000 operações** OU
    **≥ 3 reclamações/mês**;
  - `< 0,03%` → conforme; `>= 0,03%` → não conforme.
- **Art. 110** — se o monitoramento mensal resultar em "não conforme", a
  medida administrativa aplicada ao correspondente é uma das 6 (escala
  progressiva, mas a V1 apenas **registra** qual foi aplicada, não decide):
  1. Advertência
  2. Suspensão de 5 dias úteis
  3. Suspensão de 10 dias úteis
  4. Suspensão de 20 dias úteis
  5. Suspensão de 30 dias úteis
  6. Suspensão definitiva
- **Anexo I, art. 5º (Quadro 3)** — monitoramento **anual** (Fase 2, fora de
  escopo agora): cruza pontuação dos pilares do art. 51, I (TI, LGPD,
  Relacionamento com Cliente, Governança, Treinamento) com a existência de
  desvio de conduta grave → Conforme / Parcialmente Conforme / Em Atenção /
  Não Conforme.

## 3. Estrutura real dos exports do navigate (validada com agosto/2026)

Ver `etl/README.md` para o detalhamento técnico. Resumo:

- **Duas exportações, cortes temporais diferentes** (Data de Cadastro vs. Data
  de Encerramento) — não são a mesma base em janelas diferentes, se
  complementam.
- **`Tipo de Ocorrência` (1 ou 4) já vem classificado pelo navigate** — 1:1 com
  `Setor Origem`. 1 = Ação Judicial. 4 = Reclamação (Procon, Bacen, Ouvidoria,
  Consumidor.Gov, Reclame Aqui, Atendimento/Produtos, SIGEPE, Fraudes).
- **A atribuição de responsabilidade (Corban vs. Senff) só existe na
  exportação normal**, no campo `Parecer` detalhado. A exportação detalhada
  só diz Procedente/Improcedente, sem dizer de quem é a culpa.
- **~25% dos casos encerrados no mês foram abertos em meses anteriores** e não
  têm par na exportação normal do mês corrente → ficam `indefinido` e não
  entram no índice até confirmação manual.
- **Bloqueio real conhecido:** nenhuma das duas exportações traz a volumetria
  de carteira produzida (denominador do índice). Ver `docs/decisoes.md`.

## 4. O que é V1 e o que é Fase 2/3

A V1 (este repositório, nesta entrega) cobre **apenas**:

- Ingestão e cruzamento de Reclamações + Ações Judiciais (FR-1/FR-2).
- Cálculo do índice mensal (Quadro 5) com corte de aplicabilidade (FR-2).
- Painel por correspondente com Reclamações/Ações Judiciais, status e tipo de
  ocorrência mais frequente (FR-5).
- Isolamento via RLS (FR-6).
- Registro manual da medida administrativa aplicada, escala de 6 níveis
  (FR-11).

Fora de escopo nesta fase (Fase 2/3, **não implementado**): ingestão
automatizada de Auditorias Externas/Internas (entrada manual é aceitável),
classificação anual completa (Quadro 3), monitoramento de Agentes de Crédito
(Quadro 6), automação de alertas via webhook/e-mail, dashboard multi-ano,
narrativa via OpenAI, envio automatizado de e-mail via SMTP.
