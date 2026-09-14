# etl/

Scripts de ingestão e limpeza dos exports do sistema **navigate**.

- `etl_reclamacoes.py` — pipeline mensal de reclamações e ações judiciais
  (FR-1/FR-2). Lê os dois CSVs do navigate, cruza pelo
  `Protocolo`/`Identificador da ocorrência`, atribui responsabilidade
  (Corban/Senff/indefinido), aplica a regra de unitariedade e grava em
  `reclamacoes`, `acoes_judiciais` e `classificacoes_mensais` no Supabase.
- `test_etl_reclamacoes.py` — testes das regras de transformação com dados
  sintéticos (nenhum dado real/PII entra no repositório).

Pontos que sempre confundem (leia antes de mexer):

1. As duas exportações **não são redundantes**: a *detalhada* corta por data de
   **encerramento** (base motriz do mês) e a *normal* corta por data de
   **cadastro** (única fonte da atribuição Corban/Senff).
2. Só o parecer da *normal* diz de quem é a culpa. `Procedente` sem atribuição
   não conta no índice.
3. ~25% dos registros encerrados no mês foram abertos em meses anteriores e
   ficam `indefinido` — nunca somados ao índice sem confirmação manual.
4. Unitariedade deduplica por contrato **dentro do mesmo tipo** de ocorrência
   (reclamação × ação judicial do mesmo contrato contam separadas). Duplicadas
   não são gravadas no banco (schema V1 sem flag); aparecem só no `--dry-run`.

Carga no banco mapeia **somente** as colunas do schema já aplicado: ver
`registro_para_banco()` em `etl_reclamacoes.py` e `docs/decisoes.md` seção 2.

Este script usa a `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS) porque roda fora
do contexto de um usuário logado. **Nunca** usar essa chave no dashboard.

Regras validadas contra o fechamento real de agosto/2026 — ver `docs/decisoes.md`.
