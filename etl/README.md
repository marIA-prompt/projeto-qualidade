# etl/

Scripts de ingestão e limpeza dos exports do sistema **navigate**.

- `etl_reclamacoes.py` — pipeline mensal de reclamações e ações judiciais
  (FR-1/FR-2). Lê os dois CSVs do navigate, cruza pelo
  `Protocolo`/`Identificador da ocorrência`, atribui responsabilidade
  (Corban/Senff/indefinido), aplica a regra de unitariedade e grava em
  `reclamacoes`, `acoes_judiciais` e `classificacoes_mensais` no Supabase.
- `etl_carteira.py` — ingestão **manual** do denominador do Quadro 5
  (`carteira_produzida`). Planilha modelo: `modelo_carteira_produzida.csv`.
  Depois de gravar, recalcula `classificacoes_mensais` do mês (não precisa
  reimportar o navigate).
- `carregar_periodo.py` — parte um dump detalhada+normal por mês de
  encerramento e grava cada mês. `--pular-meses 2026-08` preserva o
  fechamento oficial de agosto.
- `classificar_anual.py` — calcula `classificacoes_anuais` (Quadro 3) a
  partir das ocorrências e auditorias já no banco.
- `test_etl_reclamacoes.py` / `test_etl_carteira.py` — testes com dados
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

- `criar_usuario_staff.py` — cria o primeiro usuário no Auth e o perfil `staff`
  (precisa de `SUPABASE_SERVICE_ROLE_KEY`).

    python etl/criar_usuario_staff.py --email maria.morais@senff.com.br --senha '...'

Este script usa a `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS) porque roda fora
do contexto de um usuário logado. **Nunca** usar essa chave no dashboard.

Regras validadas contra o fechamento real de agosto/2026 — ver `docs/decisoes.md`.
