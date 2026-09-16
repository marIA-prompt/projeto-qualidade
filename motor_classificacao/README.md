# motor_classificacao/

Regras **determinísticas** de classificação regulatória — Quadros 3 e 5 do
Anexo I do Normativo Correlato. Módulo Python puro, sem I/O, sem banco e sem
lógica de negócio espalhada no dashboard.

- `classificacao.py` — V1 implementa o **Quadro 5 (mensal, art. 9º)**:
  `índice = procedentes-Corban do mês ÷ carteira produzida desde jan/2023`.
  Corte de aplicabilidade: > 3.000 operações OU ≥ 3 reclamações/mês.
  `< 0,03%` → `conforme`; `≥ 0,03%` → `nao_conforme`; sem denominador ou fora
  do corte → `nao_aplicavel` (nunca inventa valor).
- `test_classificacao.py` — testes pytest: conforme, não conforme, limite
  exato, sem denominador, corte não atingido e registros indefinidos.

O Quadro 3 (classificação anual, art. 5º) está em `anual.py`: pontuação geral
(média das componentes disponíveis), cruzamento com desvio de conduta grave e
ciclo de medidas (advertência → suspensão de 10 dias → suspensão definitiva).

**Importante**: nenhuma camada de IA decide classificação regulatória. Este
motor é a única fonte do status, para ser auditável.
