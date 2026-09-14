# Plano de Qualidade de Correspondentes — V1

Sistema interno de compliance do Banco Senff para o **Plano de Qualidade de
Correspondentes** exigido pela Autorregulação do Crédito Consignado (FEBRABAN)
— arts. 50–55 do Normativo Correlato e art. 5º do Anexo I.

A V1 cobre o fechamento **mensal** (Quadro 5, art. 9º): ingestão dos exports do
navigate, cálculo do índice de reclamações/ações judiciais procedentes-Corban,
painel por correspondente com isolamento via RLS e registro manual de medidas
administrativas.

## Estrutura

| Pasta / arquivo | Propósito |
|---|---|
| `etl/` | Ingestão e limpeza dos exports do navigate (Python/pandas) |
| `motor_classificacao/` | Regras determinísticas dos Quadros 3 e 5 (funções puras + testes) |
| `dashboard/` | Painel Streamlit com login via Supabase Auth |
| `docs/` | Briefing versionado, normativos e decisões de negócio |
| `supabase_schema_rls.sql` | Schema V1 **já aplicado** no Supabase (fonte de verdade; não reexecutar CREATE TABLE) |
| `.env.example` | Modelo de variáveis de ambiente |

## Como subir do zero

1. **Banco**: o schema V1 **já está aplicado** no projeto Supabase. O arquivo
   `supabase_schema_rls.sql` é a cópia de referência — **não reexecute** os
   `CREATE TABLE` nesse projeto. Crie os usuários em *Authentication → Users*
   e insira o perfil de cada um na tabela `perfis`
   (`id` = uuid do usuário, `role` = `staff` ou `correspondente`).
2. **Ambiente**: `cp .env.example .env` e preencha `SUPABASE_URL`,
   `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
3. **Dependências**: `pip install -r requirements.txt`
4. **ETL do mês** (usa a service_role key, roda fora de contexto de usuário):

   ```bash
   python etl/etl_reclamacoes.py \
       --detalhada exportacao_detalhada_YYYYMMDD.csv \
       --normal exportacao_reclamacoes_YYYYMMDD.csv \
       --mes 2026-08
   ```

   Para conferir sem gravar no banco: acrescente `--dry-run --saida ./saida`.
5. **Denominador do índice**: carregue a volumetria de carteira produzida
   (acumulada desde jan/2023) em `carteira_produzida.operacoes_acumuladas_desde_2023`
   — entrada manual até a fonte oficial ser confirmada. Sem ela, o correspondente
   fica como `nao_aplicavel` (nunca é assumido zero). Depois rode o ETL de novo.
6. **Painel**: `streamlit run dashboard/app.py` (usa apenas a anon key; o RLS
   garante que correspondente só vê os próprios dados).

## Testes

```bash
pytest
```

Cobrem o motor de classificação (conforme / não conforme / não aplicável /
indefinidos) e as regras de cruzamento e dedupe do ETL com dados sintéticos.

## Princípios

- **Feito é melhor que perfeito**: o objetivo é destravar o fechamento do dia 25.
- **Nenhuma classificação regulatória é decidida por IA** — o motor é
  determinístico e auditável; a camada OpenAI (Fase 3) apenas redige narrativa.
- **Registros "indefinidos" nunca entram no índice** sem confirmação manual.
- **Fora de escopo na V1**: auditorias externas/internas automatizadas,
  classificação anual (Quadro 3), Agentes de Crédito, alertas por e-mail.

Fonte de verdade do escopo: `docs/Briefing_Plano_Qualidade_Correspondentes_v1.1.pdf`.
Decisões e regras validadas com dados reais: `docs/decisoes.md`.
