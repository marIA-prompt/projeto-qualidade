# dashboard/

Painel visual em **Streamlit** (FR-3, FR-5, FR-6, FR-11).

- `tema.py` — tokens visuais (arquitetura Pulso + paleta Senff: navy, acqua, Readex Pro)
- `assets/` — marcas oficiais do Banco Senff usadas no cabeçalho
- `app.py` — login via Supabase Auth (`maria.morais@senff.com.br`); abas:
  - **4 indicadores** — Reclamações, Ações Judiciais, Auditoria Externa e Interna
  - **Por correspondente** — painel visual individual (requisito Bruna Camargo)
  - **Evolução** — gráficos ao longo dos meses
  - **Alertas e relatórios** — disparo automático nas métricas + envio mensal + histórico
  - **Relacionamento** — conversa/reorientação antes de sanção
  - **Fechamento mensal** — Quadro 5 (detalhe do mês) + export CSV
  - **Fila de indefinidos** — confirmação Corban/Senff e reclassificação do mês
  - **Auditorias** — entrada manual por pilar (FR-3)
  - **Medidas administrativas** — escala de 6 níveis + discricionárias (FR-11)
- `alertas.py` / `relatorios.py` / `visoes.py` — regras e telas dos requisitos acima
- `indefinidos.py` — fila de confirmação (não inventa procedente)
- `fechamento.py` — CSV do mês no formato do analista (colunas existentes no V1)
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
