# dashboard/

Painel visual em **Streamlit** (FR-5, FR-6, FR-11).

- `app.py` — login via Supabase Auth (anon key + token do usuário, RLS ativo);
  tabela e gráfico por correspondente com reclamações, ações judiciais,
  índice/status do mês (Quadro 5) e canal de origem mais frequente; e o
  formulário de registro manual da medida administrativa aplicada
  (6 níveis + 4 medidas discricionárias do lookup já seedado).

Papéis (colunas do schema V1: `perfis.id` = `auth.uid()`, `perfis.role`):

- `staff` (Qualidade/Compliance): vê todos os correspondentes e registra medidas.
- `correspondente`: o RLS do Postgres garante que só vê os próprios dados —
  não há filtro de segurança implementado no app.

Este app **não contém lógica de negócio**: índice e status são calculados pelo
ETL + `motor_classificacao` e apenas exibidos aqui. Dados pessoais de clientes
(nome/CPF) não são exibidos no painel (minimização LGPD).

Rodar: `streamlit run dashboard/app.py`
