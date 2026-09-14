# etl/

Scripts de ingestão e tratamento dos exports do sistema **navigate**.

## Contexto

O navigate gera **duas exportações mensais que não são redundantes**:

| Export | Corte temporal | O que só ela tem |
|---|---|---|
| `exportacao_reclamacoes_*.csv` ("normal") | Data de Cadastro no mês | Nome/CPF do cliente, Nome/CNPJ do Corban, `Parecer` **detalhado** (Procedente/Improcedente - Corban/Senff) |
| `exportacao_detalhada_*.csv` | Data de Encerramento no mês | CNPJ do correspondente, CPF do agente, `Tipo de Ocorrência` numérico (1=Ação Judicial, 4=Reclamação) |

A exportação **detalhada** é a base de contagem (ela já é 1 linha = 1 ocorrência
encerrada no mês, com identificador único). A exportação **normal** só é usada
para descobrir **quem é o responsável** (Corban vs. Senff) pelo protocolo, via
join por `Identificador da ocorrência` / `Protocolo`.

Cerca de 25% dos registros da detalhada não têm par na normal do mês (casos
abertos em meses anteriores). Esses ficam com `responsavel = 'indefinido'` e
**não entram no numerador do índice** até confirmação manual.

## Arquivos

- `etl_reclamacoes.py` — script principal (CLI). Lê os dois CSVs de um mês,
  aplica as regras de negócio (ver `transform.py`) e grava em `correspondentes`,
  `reclamacoes` e `acoes_judiciais` no Supabase via `service_role key`.
- `transform.py` — funções puras de parsing/normalização/cruzamento (sem I/O de
  rede), para serem testáveis isoladamente e reutilizáveis pelo dashboard.
- `supabase_client.py` — helper para instanciar o client Supabase a partir das
  variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- `tests/` — testes com os exports reais de agosto/2026 (anonimizados apenas no
  sentido de serem dados de ambiente de teste), validando o resultado agregado
  contra `tests/fixtures/agregado_mensal_esperado_2026-08.csv` (planilha de
  conferência já calculada manualmente pela área).

## Como rodar

```bash
cp .env.example .env   # preencher SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
python -m etl.etl_reclamacoes \
    --normal caminho/exportacao_reclamacoes_2026-08.csv \
    --detalhada caminho/exportacao_detalhada_2026-08.csv \
    --mes-referencia 2026-08
```

Use `--dry-run` para rodar toda a transformação e imprimir o resumo sem gravar
no banco (útil para conferência do analista antes do fechamento do dia 25).

## Fora de escopo nesta fase

Ingestão automatizada de auditorias externas/internas e da carteira produzida
(volume de operações por correspondente) — essas entradas continuam manuais
via painel/planilha até a fonte real ser confirmada (ver `docs/decisoes.md`).
