# dashboard/

Painel visual em **Streamlit**, consumido pela Gestora de Qualidade, pelo
Analista e pelos próprios Correspondentes (cada um só enxerga seus dados).

## Autenticação e isolamento

- Login via **Supabase Auth** (e-mail/senha), usando a `anon key`.
- Depois do login, todas as consultas ao Postgres passam pelo **RLS**
  (definido em `supabase_schema_rls.sql`) — o dashboard nunca usa a
  `service_role key`. Isso garante que um correspondente autenticado só recebe
  linhas do próprio `correspondente_id`, mesmo que haja um bug de filtro na
  UI.
- Perfil `staff` (Qualidade/Compliance) enxerga todos os correspondentes;
  perfil `correspondente` enxerga só o próprio.

## Conteúdo da V1 (`app.py`)

- Tela de login (Supabase Auth).
- Seletor de mês de referência.
- Para cada correspondente visível ao usuário logado:
  - Quantidade de reclamações e ações judiciais (total / procedentes-Corban /
    procedentes-Senff / indefinidas).
  - Tipo de ocorrência mais frequente do mês.
  - Status da classificação mensal (Quadro 5): conforme / não conforme / não
    aplicável.
  - Registro manual da medida administrativa aplicada (FR-11, escala de 6
    níveis) quando o status for "não conforme".

## Fora de escopo nesta fase

Envio de e-mail, auditorias externas/internas, classificação anual (Quadro 3),
Agentes de Crédito, alertas automáticos — ver `docs/decisoes.md` e o roadmap
no briefing.

## Como rodar

```bash
cp .env.example .env   # preencher SUPABASE_URL e SUPABASE_ANON_KEY
streamlit run dashboard/app.py
```
