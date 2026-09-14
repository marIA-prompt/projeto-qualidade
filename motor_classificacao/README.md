# motor_classificacao/

Motor de regras **determinístico e puro** para a classificação regulatória dos
correspondentes, conforme o Anexo I do Normativo Correlato da Autorregulação
do Crédito Consignado.

## Por que separado do dashboard

O dashboard (Streamlit) **nunca** deve conter lógica de negócio/regra
regulatória embutida. Todo o cálculo de índice e status vive aqui, como
funções puras: recebem os agregados já limpos pelo ETL e devolvem o
resultado. Isso torna a classificação testável isoladamente (`pytest`) e
auditável — qualquer pessoa consegue ler `classificacao.py` e conferir a regra
sem precisar rodar o app.

## Escopo da V1

- `classificacao.py`
  - `classificar_mensal(...)` — Quadro 5 / art. 9º do Anexo I (monitoramento
    mensal do correspondente). É a única regra implementada nesta fase.

Fora de escopo nesta fase (Fase 2+): Quadro 3 (classificação anual, art. 5º),
Quadro 4 (medidas administrativas decorrentes do ciclo anual) e Quadro 6
(Agentes de Crédito).

## Regra do Quadro 5 (resumo)

```
índice = (reclamações procedentes-Corban + ações judiciais procedentes-Corban no mês)
          / carteira produzida pelo correspondente desde jan/2023
```

- Aplicável apenas a correspondentes com **> 3.000 operações** OU
  **≥ 3 reclamações no mês** (art. 9º, III, Anexo I).
- `índice < 0,03%` → `conforme`
- `índice >= 0,03%` → `nao_conforme`
- Sem denominador (carteira produzida) carregado, ou sem atingir o corte de
  aplicabilidade → `nao_aplicavel`. **Nunca** inventamos um índice quando falta
  o denominador.
- Registros com atribuição `indefinido` (sem par na exportação normal) não
  entram no numerador — ver `etl/README.md`.

## Testes

```bash
pytest motor_classificacao/tests -v
```

Cobrem: caso conforme, caso não conforme, caso não aplicável (sem
denominador), caso abaixo do corte de aplicabilidade, e caso com registros
"indefinido" (garantindo que eles não são somados ao índice).
