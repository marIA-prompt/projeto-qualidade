# Modelo de dados (visão geral)

Schema completo com RLS em `supabase_schema_rls.sql`. Rode-o no SQL Editor do
Supabase antes de começar a rodar o ETL ou o dashboard.

## Tabelas

| Tabela | Propósito |
|---|---|
| `correspondentes` | Cadastro (CNPJ, nome) de cada correspondente monitorado. Chave de isolamento do RLS. |
| `perfis` | Mapeia `auth.users.id` → papel (`staff` ou `correspondente`) e, quando aplicável, o `correspondente_id` vinculado. |
| `reclamacoes` | Uma linha por ocorrência tipo=4 da exportação detalhada, já com atribuição (`corban`/`senff`/`indefinido`), canal de origem e tipo de reclamação. |
| `acoes_judiciais` | Mesma estrutura de `reclamacoes`, para ocorrências tipo=1. |
| `auditorias_externas` | Entrada manual (Fase 1: campos básicos; Fase 2: subcritérios por pilar). |
| `auditorias_internas` | Idem, para auditoria interna. |
| `carteira_produzida` | Denominador do índice (Quadro 5): total de operações produzidas por correspondente, por mês de referência, desde jan/2023. Ingestão manual até a fonte real ser confirmada (ver `docs/decisoes.md`, D1). |
| `classificacoes_mensais` | Resultado gravado do motor de classificação (Quadro 5) por correspondente/mês: índice, status, aplicável, numerador/denominador usados. |
| `classificacoes_anuais` | Reservada para o Quadro 3 (Fase 2) — criada agora para não exigir migração destrutiva depois, mas não é escrita pela V1. |
| `medidas_administrativas` | Lookup fixo dos 6 níveis do art. 110 (advertência → suspensão definitiva). |
| `medidas_aplicadas` | Registro manual de qual medida foi aplicada a um correspondente, quando e por quem (FR-11). |
| `agentes_credito` | Reservada para Fase 2 (Quadro 6) — criada agora, não usada pela V1. |
| `log_alteracoes` | Trilha de auditoria (quem alterou o quê, quando) — retenção mínima de 5 anos para casos de fraude (art. 70). |

## RLS — resumo do isolamento

- `staff`: leitura (e escrita, no que a UI permitir) em todas as tabelas.
- `correspondente`: leitura restrita a linhas cujo `correspondente_id` bate com
  o vinculado ao seu perfil (`perfis.correspondente_id`), sem exceção — nem
  mesmo em `reclamacoes`/`acoes_judiciais`, que contêm dados pessoais de
  consumidores (minimizados no que for exposto pela UI).
- O ETL usa a `service_role key`, que **ignora RLS por design** — é o único
  componente autorizado a escrever em massa nas tabelas de fato
  (`reclamacoes`, `acoes_judiciais`, `correspondentes`). O dashboard nunca usa
  a `service_role key`.
