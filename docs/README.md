# docs/

Documentação e decisões versionadas do Plano de Qualidade de Correspondentes.
Existe para dar contexto de negócio ao trabalho assistido por IA no Cursor —
qualquer pessoa (ou agente) que abrir este repositório deve entender o "porquê"
das regras implementadas sem precisar ler os PDFs normativos inteiros de novo.

## Arquivos

- `plano_qualidade_correspondentes.md` — resumo executivo do briefing do
  projeto: base legal (arts. 50–55 do Normativo Correlato, art. 5º/9º do Anexo
  I), estrutura real dos exports do navigate, escala de medidas
  administrativas (art. 110) e o que fica para Fase 2/3.
- `decisoes.md` — registro das decisões de negócio tomadas (ou ainda em
  aberto) durante a construção da V1, com a justificativa e o dado que as
  embasou. Qualquer decisão de negócio nova deve ser adicionada aqui antes de
  virar código.
- `modelo_dados.md` — visão geral do schema (`supabase_schema_rls.sql`) e por
  que cada tabela existe.
