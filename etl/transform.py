"""Funções puras de parsing, normalização e cruzamento dos exports do navigate.

Nenhuma função deste módulo faz I/O de rede (sem Supabase aqui) — só leitura
de arquivo local (`pandas.read_csv`) e transformação em memória. Isso permite
testar toda a lógica de negócio do ETL sem precisar de um banco de dados.

Ver `etl/README.md` e `docs/decisoes.md` para o racional de cada regra.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

# Tipo de Ocorrência (exportação detalhada) é binário e mapeia 1:1 com Setor
# Origem (confirmado com 100% de correspondência nos dados reais de agosto/2026).
TIPO_OCORRENCIA_ACAO_JUDICIAL = "1"
TIPO_OCORRENCIA_RECLAMACAO = "4"

RESPONSAVEL_CORBAN = "corban"
RESPONSAVEL_SENFF = "senff"
RESPONSAVEL_INDEFINIDO = "indefinido"

_COLUNAS_NORMAL_ESPERADAS = {
    "Protocolo",
    "Data Cadastro",
    "Setor Origem",
    "Nome Corban",
    "CNPJ Corban",
    "Nº Contrato",
    "Tipo Reclamação",
    "Parecer",
    "Encaminhou ao Fraudes",
}

_COLUNAS_DETALHADA_ESPERADAS = {
    "Tipo de Ocorrência",
    "Cnpj do correspondente",
    "CPF do agente",
    "CPF do cliente",
    "Data da ocorrência",
    "Data de encerramento",
    "Parecer",
    "Identificador da ocorrência",
}


def _validar_colunas(df: pd.DataFrame, esperadas: set[str], nome_export: str) -> None:
    faltando = esperadas - set(df.columns)
    if faltando:
        raise ValueError(
            f"Export '{nome_export}' não tem as colunas esperadas: {sorted(faltando)}. "
            "O layout do navigate pode ter mudado — confira antes de prosseguir."
        )


def _to_null_string(serie: pd.Series) -> pd.Series:
    """O navigate exporta ausência de valor como a string literal 'null'."""
    return serie.replace({"null": None, "": None}).where(serie.notna(), None)


def ler_export_normal(caminho: str | Path) -> pd.DataFrame:
    """Lê a exportação `exportacao_reclamacoes_*.csv` (corte por Data de Cadastro)."""
    df = pd.read_csv(caminho, sep=";", encoding="utf-8-sig", dtype=str)
    _validar_colunas(df, _COLUNAS_NORMAL_ESPERADAS, "normal (exportacao_reclamacoes)")

    for coluna in ("Parecer", "Tipo Reclamação", "Encaminhou ao Fraudes", "Nome Corban"):
        df[coluna] = _to_null_string(df[coluna])

    df["Data Cadastro"] = pd.to_datetime(df["Data Cadastro"], format="%d/%m/%Y", errors="coerce")
    df["CNPJ Corban"] = df["CNPJ Corban"].str.strip()
    return df


def ler_export_detalhada(caminho: str | Path) -> pd.DataFrame:
    """Lê a exportação `exportacao_detalhada_*.csv` (corte por Data de Encerramento)."""
    df = pd.read_csv(caminho, sep=";", encoding="utf-8-sig", dtype=str)
    _validar_colunas(df, _COLUNAS_DETALHADA_ESPERADAS, "detalhada (exportacao_detalhada)")

    tipos_invalidos = set(df["Tipo de Ocorrência"].unique()) - {
        TIPO_OCORRENCIA_ACAO_JUDICIAL,
        TIPO_OCORRENCIA_RECLAMACAO,
    }
    if tipos_invalidos:
        raise ValueError(
            f"Valores inesperados em 'Tipo de Ocorrência': {tipos_invalidos}. "
            "Esperado apenas '1' (Ação Judicial) ou '4' (Reclamação)."
        )

    df["Data da ocorrência"] = pd.to_datetime(df["Data da ocorrência"], format="%d/%m/%Y", errors="coerce")
    df["Data de encerramento"] = pd.to_datetime(df["Data de encerramento"], format="%d/%m/%Y", errors="coerce")
    df["Cnpj do correspondente"] = df["Cnpj do correspondente"].str.strip()
    return df


def _atribuir_responsavel(parecer_normal: Optional[str]) -> str:
    """Quem atribui a responsabilidade Corban/Senff é o Parecer da exportação
    NORMAL — o parecer da detalhada só diz Procedente/Improcedente (art. 53).
    """
    if not parecer_normal:
        return RESPONSAVEL_INDEFINIDO
    if "Corban" in parecer_normal:
        return RESPONSAVEL_CORBAN
    if "Senff" in parecer_normal:
        return RESPONSAVEL_SENFF
    return RESPONSAVEL_INDEFINIDO


def cruzar_ocorrencias(df_detalhada: pd.DataFrame, df_normal: pd.DataFrame, mes_referencia: str) -> pd.DataFrame:
    """Cruza a exportação detalhada (base de contagem, 1 linha = 1 ocorrência
    encerrada no mês) com a normal (fonte da atribuição Corban/Senff), via
    `Identificador da ocorrência` <-> `Protocolo`.

    ~25% dos registros da detalhada não têm par na normal do mês corrente
    (casos abertos em meses anteriores) — ficam com `responsavel='indefinido'`
    e não devem ser somados ao índice (ver docs/decisoes.md, D2).
    """
    normal_indexado = df_normal.set_index("Protocolo")

    linhas = []
    for _, linha in df_detalhada.iterrows():
        identificador = linha["Identificador da ocorrência"]
        par_normal = normal_indexado.loc[identificador] if identificador in normal_indexado.index else None

        parecer_normal = par_normal["Parecer"] if par_normal is not None else None
        responsavel = _atribuir_responsavel(parecer_normal)
        parecer_detalhado = linha["Parecer"].strip().lower()  # 'Procedente' / 'Improcedente'
        procedente = parecer_detalhado == "procedente"

        encaminhado_fraudes = bool(par_normal is not None and pd.notna(par_normal["Encaminhou ao Fraudes"]))

        linhas.append(
            {
                "correspondente_cnpj": linha["Cnpj do correspondente"],
                "correspondente_nome": par_normal["Nome Corban"] if par_normal is not None else None,
                "mes_referencia": mes_referencia,
                "tipo_ocorrencia": linha["Tipo de Ocorrência"],
                "identificador_ocorrencia": identificador,
                "protocolo_normal": identificador if par_normal is not None else None,
                "numero_contrato": par_normal["Nº Contrato"] if par_normal is not None else None,
                "cpf_agente": linha["CPF do agente"],
                "cpf_cliente": linha["CPF do cliente"],
                "canal_origem": par_normal["Setor Origem"] if par_normal is not None else None,
                "tipo_reclamacao": par_normal["Tipo Reclamação"] if par_normal is not None else None,
                "data_ocorrencia": linha["Data da ocorrência"],
                "data_encerramento": linha["Data de encerramento"],
                "data_cadastro_normal": par_normal["Data Cadastro"] if par_normal is not None else None,
                "parecer_detalhado": parecer_detalhado,
                "responsavel": responsavel,
                "procedente_corban": bool(procedente and responsavel == RESPONSAVEL_CORBAN),
                "procedente_senff": bool(procedente and responsavel == RESPONSAVEL_SENFF),
                "encaminhado_fraudes": encaminhado_fraudes,
            }
        )

    return pd.DataFrame(linhas)


def deduplicar_por_contrato(df: pd.DataFrame) -> pd.DataFrame:
    """Regra de unitariedade (art. 9º, II, Anexo I): ocorrências do mesmo
    contrato recebidas em mais de um canal contam uma única vez.

    A exportação detalhada já é naturalmente unitária (1 `identificador_ocorrencia`
    único por ocorrência) — validado com os dados reais de agosto/2026 (zero
    duplicatas de contrato por correspondente/tipo). Esta função é uma
    salvaguarda defensiva para o caso de um mês futuro apresentar duplicatas:
    mantém o primeiro registro (por `identificador_ocorrencia`) e loga um
    aviso, em vez de somar as duas ocorrências no índice.
    """
    com_contrato = df["numero_contrato"].notna()
    sem_contrato = df[~com_contrato]
    chave = ["correspondente_cnpj", "tipo_ocorrencia", "numero_contrato"]

    duplicadas = df[com_contrato].duplicated(subset=chave, keep="first")
    if duplicadas.any():
        logger.warning(
            "Regra de unitariedade: %d ocorrência(s) do mesmo contrato em múltiplos "
            "canais foram descartadas (mantendo a primeira). Revisar manualmente.",
            int(duplicadas.sum()),
        )

    deduplicado_com_contrato = df[com_contrato][~duplicadas]
    return pd.concat([deduplicado_com_contrato, sem_contrato], ignore_index=True)


def separar_por_tipo(df_unificado: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Divide o dataframe cruzado em (reclamacoes, acoes_judiciais)."""
    reclamacoes = df_unificado[df_unificado["tipo_ocorrencia"] == TIPO_OCORRENCIA_RECLAMACAO].copy()
    acoes = df_unificado[df_unificado["tipo_ocorrencia"] == TIPO_OCORRENCIA_ACAO_JUDICIAL].copy()
    return reclamacoes.reset_index(drop=True), acoes.reset_index(drop=True)


def extrair_correspondentes(df_unificado: pd.DataFrame) -> pd.DataFrame:
    """Lista única de (cnpj, nome) vistos no mês, para upsert em `correspondentes`.

    Quando o mesmo CNPJ aparece com nomes diferentes (ou nulo), usamos o
    primeiro nome não nulo encontrado.
    """
    ordenado = df_unificado.sort_values(
        by="correspondente_nome", key=lambda s: s.isna(), kind="stable"
    )
    return (
        ordenado.groupby("correspondente_cnpj", as_index=False)
        .first()[["correspondente_cnpj", "correspondente_nome"]]
        .rename(columns={"correspondente_cnpj": "cnpj", "correspondente_nome": "nome"})
    )


def montar_resumo_mensal(df_unificado: pd.DataFrame) -> pd.DataFrame:
    """Agregado por correspondente/mês, no mesmo formato da planilha de
    conferência (`agregado_mensal_correspondentes_*.csv`) usada para validar
    o ETL contra o cálculo manual da área. Útil para `--dry-run` e testes.
    """

    def _linha_frequente(serie: pd.Series) -> Optional[str]:
        validos = serie.dropna()
        if validos.empty:
            return None
        return validos.value_counts().idxmax()

    linhas = []
    for cnpj, grupo in df_unificado.groupby("correspondente_cnpj"):
        reclamacoes = grupo[grupo["tipo_ocorrencia"] == TIPO_OCORRENCIA_RECLAMACAO]
        acoes = grupo[grupo["tipo_ocorrencia"] == TIPO_OCORRENCIA_ACAO_JUDICIAL]

        qtd_reclamacoes_procedentes_corban = int(reclamacoes["procedente_corban"].sum())
        qtd_acoes_procedentes_corban = int(acoes["procedente_corban"].sum())

        linhas.append(
            {
                "cnpj_correspondente": cnpj,
                "nome_correspondente": grupo["correspondente_nome"].dropna().iloc[0]
                if grupo["correspondente_nome"].notna().any()
                else None,
                "qtd_reclamacoes_total": len(reclamacoes),
                "qtd_reclamacoes_procedentes_corban": qtd_reclamacoes_procedentes_corban,
                "qtd_reclamacoes_procedentes_senff": int(reclamacoes["procedente_senff"].sum()),
                "qtd_reclamacoes_indefinidas": int((reclamacoes["responsavel"] == RESPONSAVEL_INDEFINIDO).sum()),
                "qtd_acoes_judiciais_total": len(acoes),
                "qtd_acoes_judiciais_procedentes_corban": qtd_acoes_procedentes_corban,
                "qtd_acoes_judiciais_procedentes_senff": int(acoes["procedente_senff"].sum()),
                "qtd_acoes_judiciais_indefinidas": int((acoes["responsavel"] == RESPONSAVEL_INDEFINIDO).sum()),
                "qtd_encaminhadas_fraudes": int(grupo["encaminhado_fraudes"].sum()),
                "tipo_ocorrencia_mais_frequente": _linha_frequente(reclamacoes["tipo_reclamacao"]),
                "numerador_indice_quadro5": qtd_reclamacoes_procedentes_corban + qtd_acoes_procedentes_corban,
            }
        )

    return pd.DataFrame(linhas)


def processar_mes(caminho_normal: str | Path, caminho_detalhada: str | Path, mes_referencia: str) -> dict[str, pd.DataFrame]:
    """Pipeline completo em memória (sem I/O de banco): lê os dois exports,
    cruza, dedupe e separa por tipo. Ponto de entrada usado tanto pelo CLI
    (`etl_reclamacoes.py`) quanto pelos testes.
    """
    df_normal = ler_export_normal(caminho_normal)
    df_detalhada = ler_export_detalhada(caminho_detalhada)

    df_unificado = cruzar_ocorrencias(df_detalhada, df_normal, mes_referencia)
    df_unificado = deduplicar_por_contrato(df_unificado)

    reclamacoes, acoes_judiciais = separar_por_tipo(df_unificado)
    correspondentes = extrair_correspondentes(df_unificado)
    resumo = montar_resumo_mensal(df_unificado)

    return {
        "correspondentes": correspondentes,
        "reclamacoes": reclamacoes,
        "acoes_judiciais": acoes_judiciais,
        "resumo_mensal": resumo,
    }
