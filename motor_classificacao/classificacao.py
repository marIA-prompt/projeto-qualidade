"""Motor de classificação mensal de correspondentes (Quadro 5, art. 9º, Anexo I).

Módulo Python puro e testável. NÃO faz I/O (sem chamadas a banco, rede ou
arquivo) e NÃO contém nenhuma lógica de UI — recebe os agregados já limpos
pelo ETL (`etl/transform.py`) e devolve o resultado da classificação.

Regra (Quadro 5, art. 9º do Anexo I):

    índice = (reclamações + ações judiciais procedentes-Corban no mês)
             / (carteira produzida pelo correspondente desde jan/2023)

    - Aplicável apenas a correspondentes com > 3.000 operações OU
      >= 3 reclamações no mês (art. 9º, III). O texto normativo não qualifica
      "reclamações/mês" como "procedentes"; adotamos o total de reclamações
      registradas no mês (qualquer parecer) como o critério de materialidade
      que ativa a obrigação de monitoramento — ver docs/decisoes.md.
    - índice < 0,03% -> conforme
    - índice >= 0,03% -> não conforme
    - Sem carteira produzida carregada para o correspondente/mês, ou corte de
      aplicabilidade não atingido -> não aplicável. Nunca se inventa um índice
      quando falta o denominador.

Importante: os registros marcados como `responsavel = 'indefinido'` (sem
atribuição Corban/Senff confirmada — ver etl/README.md) NÃO devem ser somados
em `qtd_reclamacoes_procedentes_corban` / `qtd_acoes_procedentes_corban` antes
de chamar `classificar_mensal`. Essa exclusão é responsabilidade da etapa de
agregação (ETL); este módulo apenas confia no valor recebido.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

LIMITE_INDICE = 0.0003
"""0,03% — limite do Quadro 5. índice >= LIMITE_INDICE => não conforme."""

LIMITE_OPERACOES = 3000
"""Corte de aplicabilidade: correspondente precisa ter MAIS de 3.000 operações..."""

LIMITE_RECLAMACOES_MES = 3
"""...OU 3 ou mais reclamações no mês (o que vier primeiro torna aplicável)."""

StatusClassificacao = Literal["conforme", "nao_conforme", "nao_aplicavel"]


@dataclass(frozen=True)
class AgregadoMensalCorrespondente:
    """Insumo do motor: agregados já limpos e deduplicados pelo ETL para um
    único correspondente em um único mês de referência.
    """

    correspondente_id: str
    mes_referencia: str
    qtd_reclamacoes_procedentes_corban: int
    qtd_acoes_procedentes_corban: int
    qtd_reclamacoes_mes: int
    total_operacoes: Optional[int]
    """Carteira produzida desde jan/2023 (denominador). None = não carregada
    ainda para este correspondente/mês (ver tabela `carteira_produzida`)."""

    def __post_init__(self) -> None:
        for campo in ("qtd_reclamacoes_procedentes_corban", "qtd_acoes_procedentes_corban", "qtd_reclamacoes_mes"):
            valor = getattr(self, campo)
            if valor < 0:
                raise ValueError(f"{campo} não pode ser negativo (recebido: {valor})")
        if self.total_operacoes is not None and self.total_operacoes < 0:
            raise ValueError(f"total_operacoes não pode ser negativo (recebido: {self.total_operacoes})")


@dataclass(frozen=True)
class ResultadoClassificacaoMensal:
    """Saída do motor: pronta para ser persistida em `classificacoes_mensais`."""

    correspondente_id: str
    mes_referencia: str
    numerador: int
    denominador: Optional[int]
    indice: Optional[float]
    aplicavel: bool
    status: StatusClassificacao
    motivo_nao_aplicavel: Optional[str] = None


def classificar_mensal(agregado: AgregadoMensalCorrespondente) -> ResultadoClassificacaoMensal:
    """Aplica a regra do Quadro 5 (art. 9º, Anexo I) a um correspondente/mês.

    Nunca levanta exceção por falta de dado de negócio (carteira ausente,
    corte não atingido) — esses casos resultam em `status='nao_aplicavel'`
    com o motivo explicado em `motivo_nao_aplicavel`.
    """
    numerador = agregado.qtd_reclamacoes_procedentes_corban + agregado.qtd_acoes_procedentes_corban

    if agregado.total_operacoes is None:
        return ResultadoClassificacaoMensal(
            correspondente_id=agregado.correspondente_id,
            mes_referencia=agregado.mes_referencia,
            numerador=numerador,
            denominador=None,
            indice=None,
            aplicavel=False,
            status="nao_aplicavel",
            motivo_nao_aplicavel=(
                "carteira produzida (denominador) não carregada para este "
                "correspondente/mês em `carteira_produzida`"
            ),
        )

    denominador = agregado.total_operacoes
    aplicavel = denominador > LIMITE_OPERACOES or agregado.qtd_reclamacoes_mes >= LIMITE_RECLAMACOES_MES

    if not aplicavel:
        return ResultadoClassificacaoMensal(
            correspondente_id=agregado.correspondente_id,
            mes_referencia=agregado.mes_referencia,
            numerador=numerador,
            denominador=denominador,
            indice=None,
            aplicavel=False,
            status="nao_aplicavel",
            motivo_nao_aplicavel=(
                f"corte de aplicabilidade não atingido (operações={denominador} <= "
                f"{LIMITE_OPERACOES} e reclamações/mês={agregado.qtd_reclamacoes_mes} < "
                f"{LIMITE_RECLAMACOES_MES})"
            ),
        )

    if denominador == 0:
        return ResultadoClassificacaoMensal(
            correspondente_id=agregado.correspondente_id,
            mes_referencia=agregado.mes_referencia,
            numerador=numerador,
            denominador=denominador,
            indice=None,
            aplicavel=False,
            status="nao_aplicavel",
            motivo_nao_aplicavel="carteira produzida (denominador) é zero, índice indefinido",
        )

    indice = numerador / denominador
    status: StatusClassificacao = "nao_conforme" if indice >= LIMITE_INDICE else "conforme"

    return ResultadoClassificacaoMensal(
        correspondente_id=agregado.correspondente_id,
        mes_referencia=agregado.mes_referencia,
        numerador=numerador,
        denominador=denominador,
        indice=indice,
        aplicavel=True,
        status=status,
    )
