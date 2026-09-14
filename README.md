# Plano de Qualidade de Correspondentes — V1 (MVP)

Sistema interno de Compliance do Banco Senff para operacionalizar o **Plano de
Qualidade de Correspondentes** exigido pelos arts. 50–55 do Normativo
Correlato da Autorregulação do Crédito Consignado (FEBRABAN) e pelo art. 5º
do Anexo I — substituindo o processo manual atual (export do navigate →
tratamento em Excel → envio ao MCB) por uma base única, auditável e
segregada por correspondente.

> Contexto completo, base legal e decisões de negócio: ver `docs/`.
> Este é o entregável da **Fase 1 (MVP)** — ver seção "Escopo" abaixo.

## Stack

| Camada | Tecnologia |
|---|---|
| ETL / tratamento de dados | Python (pandas) |
| Banco de dados | Supabase (Postgres) com RLS |
| Motor de classificação | Módulo Python puro e testável (`motor_classificacao/classificacao.py`) |
| Painel visual | Streamlit |
| Controle de versão | Git |

## Estrutura do repositório

```
├── etl/                    # ingestão e limpeza dos exports do navigate (FR-1/FR-2)
├── motor_classificacao/    # regras determinísticas do Quadro 5 (FR-2)
├── dashboard/              # app Streamlit (FR-5/FR-6/FR-11)
├── docs/                   # briefing e decisões de negócio versionadas
├── supabase_schema_rls.sql # schema completo + políticas de RLS
├── requirements.txt
└── .env.example
```

Cada pasta tem seu próprio `README.md` com o contexto necessário.

## Como rodar

### 1. Banco de dados

Crie um projeto no [Supabase](https://supabase.com) (plano gratuito) e rode
`supabase_schema_rls.sql` inteiro no SQL Editor.

### 2. Ambiente Python

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # preencha SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
```

### 3. ETL (ingestão do mês fechado)

```bash
# conferência sem gravar no banco
python -m etl.etl_reclamacoes \
    --normal caminho/exportacao_reclamacoes_2026-08.csv \
    --detalhada caminho/exportacao_detalhada_2026-08.csv \
    --mes-referencia 2026-08 \
    --dry-run

# gravação real (correspondentes, reclamacoes, acoes_judiciais) + cálculo
# best-effort da classificação mensal
python -m etl.etl_reclamacoes \
    --normal caminho/exportacao_reclamacoes_2026-08.csv \
    --detalhada caminho/exportacao_detalhada_2026-08.csv \
    --mes-referencia 2026-08
```

Depois de carregar manualmente a `carteira_produzida` do mês (ver
`docs/decisoes.md`, D1), recalcule a classificação sem reprocessar os CSVs:

```bash
python -m etl.calcular_classificacoes --mes-referencia 2026-08
```

### 4. Dashboard

```bash
streamlit run dashboard/app.py
```

### 5. Testes

```bash
pytest
```

Os testes do ETL rodam contra as exportações **reais** de agosto/2026
(`etl/tests/fixtures/`) e validam o resultado, linha a linha, contra a
planilha de conferência que a área já havia calculado manualmente
(`agregado_mensal_esperado_2026-08.csv`) — zero divergência é a garantia de
que as regras de negócio da seção 6 do briefing foram implementadas
corretamente.

## Escopo da Fase 1 (esta entrega)

- **FR-1** — Importar as duas exportações do navigate e normalizar
  reclamações/ações judiciais do mês fechado.
- **FR-2** — Calcular o índice mensal (Quadro 5, art. 9º) e aplicar o corte
  de aplicabilidade.
- **FR-5** — Painel por correspondente com Reclamações, Ações Judiciais,
  status e tipo de ocorrência mais frequente.
- **FR-6** — Isolamento via RLS (nenhum correspondente vê dados de outro).
- **FR-11** — Registro manual da medida administrativa aplicada (escala de 6
  níveis).

**Fora de escopo nesta fase** (Fase 2/3): ingestão automatizada de auditorias
externas/internas, classificação anual (Quadro 3), Agentes de Crédito,
alertas automáticos, envio de e-mail (SMTP), narrativa via OpenAI, dashboard
multi-ano. Ver `docs/plano_qualidade_correspondentes.md` e
`docs/decisoes.md` para o racional completo.
