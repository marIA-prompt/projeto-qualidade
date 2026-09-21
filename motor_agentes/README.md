# motor_agentes/

Regras **determinísticas** do agente de crédito — Quadro 6, MCB e arquivo 104
(Anexo I, arts. 11–14). Pacote **separado** de `motor_classificacao/` (Quadro 5
de correspondentes). Sem I/O, sem banco, sem IA.

- `classificacao.py` — Quadro 6 mensal: teto **≤ 0,75% conforme**; corte **ops > 50 E rec > 1**.
- `mcb.py` — 5 pontos por NC, janela 12 meses, 20 pts → suspensão temporária; reincidência → definitiva.
- `fraude.py` — trilho 104 por Participantes distintos.
- `cpf.py` — normalização e máscara `***.***.***-99`.
