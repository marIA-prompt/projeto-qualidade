# Decisões de negócio — registro versionado

Este documento existe porque decisões de negócio em um sistema regulado
precisam ser auditáveis. Toda decisão que não estava 100% explícita no
briefing, mas que precisou ser tomada para o código funcionar, está registrada
aqui com a justificativa e o dado que a embasou. **Decisões marcadas como "em
aberto" são bloqueios reais e não devem ser contornadas com suposições
silenciosas no código.**

## Decisões tomadas nesta entrega (V1)

### D1 — Fonte da carteira produzida (denominador do índice)

**Situação:** nenhuma das duas exportações do navigate traz a volumetria de
carteira produzida por correspondente desde jan/2023 (o denominador do art. 9º
/ Quadro 5). Essa é a origem de dados que falta identificar (provavelmente o
sistema de originação de contratos, não o navigate).

**Decisão adotada (V1):** criar a tabela `carteira_produzida` já esperando
**ingestão manual** (upload de planilha pelo analista, um valor de
`total_operacoes` acumulado desde jan/2023 por correspondente/mês). O motor de
classificação (`motor_classificacao/classificacao.py`) verifica se existe uma
linha carregada para o correspondente/mês em questão; se não existir, o status
retorna **`nao_aplicavel`** em vez de quebrar, assumir zero, ou inventar um
percentual.

**Status:** ⚠️ Em aberto quanto à fonte real. A tabela e o motor já estão
prontos para receber o dado assim que a fonte for confirmada — só falta o
carregamento automatizado, que fica para Fase 2/3.

### D2 — Registros "indefinido" (sem atribuição Corban/Senff)

**Situação confirmada com os dados reais de agosto/2026:** 66 dos 263
registros da exportação detalhada (25%) são casos abertos em meses anteriores
e encerrados em agosto, portanto sem par na exportação normal de agosto (que
só traz quem foi *cadastrado* em agosto).

**Decisão adotada:** esses registros são gravados nas tabelas `reclamacoes` /
`acoes_judiciais` com `responsavel = 'indefinido'` e `procedente = null`
quando aplicável, e **explicitamente excluídos do numerador do índice**
(Quadro 5) até que alguém confirme manualmente a atribuição (ex.: cruzando com
a exportação normal de meses anteriores). Não implementamos nesta fase um
mecanismo de acumular exportações normais de meses anteriores para resolver
isso automaticamente — ver ponto em aberto (A2) abaixo.

### D3 — Regra de unitariedade (mesmo contrato em múltiplos canais)

**Situação:** o Quadro 5 (art. 9º, II, Anexo I) exige que ocorrências do mesmo
contrato recebidas em mais de um canal contem uma única vez.

**Verificação com os dados reais:** a exportação **detalhada** já é
naturalmente unitária — cada linha tem um `Identificador da ocorrência` único,
e não encontramos, nos dados de agosto/2026, dois registros da detalhada
referentes ao mesmo contrato e ao mesmo correspondente/tipo (validado
cruzando com o nº de contrato da exportação normal). Isso bate exatamente com
o `agregado_mensal_correspondentes_2026-08.csv` fornecido como conferência
(zero divergência linha a linha).

**Decisão adotada:** a agregação para o índice é feita a partir da exportação
**detalhada** (não da normal), que evita a duplicação por canal por
construção. Como salvaguarda, o ETL (`etl/transform.py`) ainda aplica uma
deduplicação defensiva por `(cnpj_correspondente, tipo_ocorrencia, nº
contrato)` quando o nº do contrato está disponível (via join com a normal),
para o caso de um mês futuro em que a mesma ocorrência apareça duplicada na
detalhada — mantém o primeiro registro e loga um aviso.

### D4 — Escala de medida administrativa (FR-11)

**Decisão adotada:** usamos exatamente os 6 níveis do art. 110 do Normativo
Correlato (advertência; suspensão de 5/10/20/30 dias úteis; suspensão
definitiva) como lookup em `medidas_administrativas`. O registro de qual nível
foi aplicado a um correspondente em `medidas_aplicadas` é **sempre manual**
(ato humano da Gestora de Qualidade) — o sistema não decide nem sugere
automaticamente nesta fase.

### D5 — Papéis de acesso (RLS)

**Decisão adotada:** dois papéis nesta fase — `staff` (Qualidade/Compliance,
acesso a todos os correspondentes) e `correspondente` (acesso restrito ao
próprio `correspondente_id`, via tabela `perfis` que mapeia
`auth.users.id → correspondente_id/papel`). Sem papel de "auditoria
externa/interna" ainda — fica para quando o módulo de auditorias (Fase 2) for
implementado.

## Pontos em aberto (não bloqueiam a V1 solicitada, mas precisam de decisão antes da Fase 2)

- **A1.** Qual é a fonte real da volumetria de carteira produzida por
  correspondente (sistema de originação)? Sem isso, `carteira_produzida`
  continua alimentada manualmente e o índice de vários correspondentes ficará
  `nao_aplicavel` mesmo quando o corte de aplicabilidade (≥3 reclamações/mês)
  for atingido.
- **A2.** Para os ~25% de casos "indefinido": manter exportações normais de
  meses anteriores acumuladas para cruzar retroativamente, ou pedir para o
  navigate incluir a atribuição Corban/Senff diretamente na exportação
  detalhada? Nenhuma das duas foi implementada na V1 — o comportamento atual é
  apenas **não somar** esses casos até confirmação manual.
- **A3.** Existe um limiar interno de alerta mais conservador que o
  regulatório (ex.: 80% do limite de 0,03%)? Não implementado — a V1 só expõe
  o status regulatório puro (conforme/não conforme/não aplicável), sem alerta
  proativo (alertas são Fase 3).
- **A4.** Critério de escolha entre os 6 níveis de medida administrativa
  (reincidência, gravidade)? Não implementado — decisão sempre manual e
  caso a caso nesta fase.
- **A5.** Servidor/credenciais SMTP e caixa de e-mail remetente — não
  necessário na V1 (envio de e-mail é Fase 3), mas o `.env.example` já reserva
  as variáveis para quando for implementado.

## Regra explícita de "não inventar dado"

Em qualquer ponto em que faltar informação (denominador da carteira, mês sem
export carregado, atribuição de responsabilidade indefinida), o comportamento
padrão do código é **marcar como indisponível/não aplicável e parar**, nunca
assumir um valor default que produza uma classificação regulatória
tecnicamente incorreta.
