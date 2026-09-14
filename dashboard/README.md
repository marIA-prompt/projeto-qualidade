# dashboard/

Painel visual em **Streamlit** (FR-3, FR-5, FR-6, FR-11).

- `app.py` — login via Supabase Auth; abas:
  - **4 indicadores** — Reclamações, Ações Judiciais, Auditoria Externa e Interna
  - **Fechamento mensal** — Quadro 5 (detalhe do mês)
  - **Auditorias** — entrada manual por pilar (FR-3)
  - **Medidas administrativas** — escala de 6 níveis + discricionárias (FR-11)
- `pilares.py` — catálogo de pilares/subcritérios e cálculo da pontuação do pilar
- `auditorias_ui.py` — formulário e histórico de auditorias

Papéis (`perfis.id` = `auth.uid()`, `perfis.role`):

- `staff` (Qualidade/Compliance): vê todos os correspondentes e registra medidas.
- `correspondente`: o RLS do Postgres garante que só vê os próprios dados —
  não há filtro de segurança implementado no app.

Este app **não contém lógica de negócio**: índice e status são calculados pelo
ETL + `motor_classificacao` e apenas exibidos aqui. Dados pessoais de clientes
(nome/CPF) não são exibidos no painel (minimização LGPD).

Rodar: `streamlit run dashboard/app.py`
