"""ETL de reclamações e ações judiciais — exports do navigate (FR-1 / FR-2).

Lê as duas exportações mensais do navigate, cruza, deduplica (unitariedade),
atribui responsabilidade (Corban/Senff/indefinido), grava em `reclamacoes` e
`acoes_judiciais` no Supabase e calcula a classificação mensal (Quadro 5).

As duas exportações NÃO são redundantes:
  * detalhada -> corte por Data de Encerramento no mês; traz CNPJ do
    correspondente e Tipo de Ocorrência (1 = ação judicial, 4 = reclamação).
    É a base "motriz" do fechamento mensal.
  * normal    -> corte por Data de Cadastro no mês; é a ÚNICA fonte do parecer
    com atribuição de responsabilidade (Procedente/Improcedente - Corban/Senff).

Registros da detalhada sem par na normal (casos abertos em meses anteriores,
~25% em agosto/2026) ficam com responsavel='indefinido' e NÃO entram no índice
até confirmação manual.

Uso:
    python etl/etl_reclamacoes.py \
        --detalhada exportacao_detalhada_YYYYMMDD.csv \
        --normal exportacao_reclamacoes_YYYYMMDD.csv \
        --mes 2026-08

    # Sem gravar no banco (gera CSVs de conferência em --saida):
    python etl/etl_reclamacoes.py ... --dry-run --saida ./saida

Credenciais (apenas para carga no banco): SUPABASE_URL e
SUPABASE_SERVICE_ROLE_KEY no ambiente ou em um arquivo .env na raiz.
A service_role key NUNCA deve ser usada no dashboard.

Regras validadas com o fechamento real de agosto/2026 — ver
docs/decisoes.md antes de alterar qualquer regra deste arquivo.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import pandas as pd

# Permite importar o motor de classificação a partir da raiz do repositório.
RAIZ_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ_REPO))

from motor_classificacao.classificacao import classificar_mensal  # noqa: E402

log = logging.getLogger("etl_reclamacoes")

TIPO_ACAO_JUDICIAL = "1"
TIPO_RECLAMACAO = "4"

COLUNAS_DETALHADA = [
    "Tipo de Ocorrência", "Cnpj do correspondente", "CPF do agente",
    "CPF do cliente", "Data da ocorrência", "Data de encerramento",
    "Parecer", "Data Inicio do contrato", "Identificador da ocorrência",
]

COLUNAS_NORMAL = [
    "Protocolo", "Data Cadastro", "Hora Cadastro", "Usuário Cadastro",
    "Setor Origem", "Nome Cliente", "CPF Cliente", "Data Aprovação",
    "Convênio", "Nº Contrato", "Nome Corban", "CNPJ Corban", "Digitador",
    "CPF Digitador", "Tipo Reclamação", "Parecer", "Encaminhou ao Fraudes",
    "Data Finalização", "Hora Finalização", "Usuário Finalização",
    "Observações Cadastro", "Observações Fraude",
]


@dataclass
class RelatorioQualidade:
    """Achados de data quality da ingestão, para conferência do analista."""

    total_detalhada: int = 0
    total_normal: int = 0
    sem_par_na_normal: int = 0
    duplicadas_unitariedade: int = 0
    encerradas_fora_do_mes: int = 0
    dias_uteis_sem_registro: list = field(default_factory=list)
    avisos: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# Leitura e validação
# ---------------------------------------------------------------------------

def _ler_csv(caminho: str, colunas_esperadas: list[str], nome: str) -> pd.DataFrame:
    df = pd.read_csv(caminho, sep=";", dtype=str)
    df.columns = df.columns.str.strip()
    faltantes = [c for c in colunas_esperadas if c not in df.columns]
    if faltantes:
        raise ValueError(
            f"Export {nome} ({caminho}) sem as colunas esperadas: {faltantes}. "
            "O layout do navigate mudou? Confirme antes de prosseguir."
        )
    for col in df.columns:
        df[col] = df[col].str.strip()
    return df


def carregar_detalhada(caminho: str) -> pd.DataFrame:
    df = _ler_csv(caminho, COLUNAS_DETALHADA, "detalhada")
    tipos_invalidos = set(df["Tipo de Ocorrência"].dropna()) - {TIPO_ACAO_JUDICIAL, TIPO_RECLAMACAO}
    if tipos_invalidos:
        raise ValueError(
            f"Tipo de Ocorrência fora do domínio conhecido (1=ação judicial, "
            f"4=reclamação): {tipos_invalidos}. Parar e confirmar com a área."
        )
    if df["Identificador da ocorrência"].duplicated().any():
        raise ValueError("Identificador da ocorrência duplicado no export detalhado.")
    return df


def carregar_normal(caminho: str) -> pd.DataFrame:
    df = _ler_csv(caminho, COLUNAS_NORMAL, "normal")
    if df["Protocolo"].duplicated().any():
        raise ValueError("Protocolo duplicado no export normal.")
    return df


def _parse_data(serie: pd.Series) -> pd.Series:
    return pd.to_datetime(serie, format="%d/%m/%Y", errors="coerce").dt.date


# ---------------------------------------------------------------------------
# Transformação (funções puras — testáveis sem banco)
# ---------------------------------------------------------------------------

def _atribuir_responsavel(parecer_detalhado) -> str:
    """A atribuição Corban/Senff vem SÓ do parecer do export normal."""
    if pd.isna(parecer_detalhado):
        return "indefinido"
    if parecer_detalhado.endswith("Corban"):
        return "corban"
    if parecer_detalhado.endswith("Senff"):
        return "senff"
    return "indefinido"


def transformar(
    detalhada: pd.DataFrame,
    normal: pd.DataFrame,
    mes_referencia: date,
) -> tuple[pd.DataFrame, RelatorioQualidade]:
    """Cruza os dois exports e devolve as ocorrências normalizadas do mês.

    A base motriz é a detalhada (ocorrências encerradas no mês). O export
    normal fornece a atribuição de responsabilidade, contrato, canal e cliente.
    """
    rel = RelatorioQualidade(total_detalhada=len(detalhada), total_normal=len(normal))

    m = detalhada.merge(
        normal,
        left_on="Identificador da ocorrência",
        right_on="Protocolo",
        how="left",
        suffixes=("_det", "_norm"),
    )

    rel.sem_par_na_normal = int(m["Protocolo"].isna().sum())
    if rel.sem_par_na_normal:
        pct = 100 * rel.sem_par_na_normal / len(m)
        rel.avisos.append(
            f"{rel.sem_par_na_normal} de {len(m)} registros ({pct:.0f}%) sem classificação "
            "final no export normal (abertos em meses anteriores): ficam fora do índice. "
            "Só entram em andamento se o parecer ainda não for Procedente/Improcedente."
        )

    df = pd.DataFrame({
        "id": m["Identificador da ocorrência"],
        "tipo_ocorrencia": m["Tipo de Ocorrência"],
        "cnpj_correspondente": m["Cnpj do correspondente"],
        "nome_correspondente": m["Nome Corban"],
        "protocolo": m["Protocolo"],
        "canal_origem": m["Setor Origem"],
        "tipo_reclamacao": m["Tipo Reclamação"],
        "parecer": m["Parecer_det"],
        "parecer_detalhado": m["Parecer_norm"],
        "numero_contrato": m["Nº Contrato"],
        "cpf_cliente": m["CPF do cliente"],
        "nome_cliente": m["Nome Cliente"],
        "cpf_agente": m["CPF do agente"],
        "encaminhou_fraudes": m["Encaminhou ao Fraudes"].notna(),
        "data_ocorrencia": _parse_data(m["Data da ocorrência"]),
        "data_cadastro": _parse_data(m["Data Cadastro"]),
        "data_encerramento": _parse_data(m["Data de encerramento"]),
    })
    df["procedente"] = df["parecer_detalhado"].apply(
        lambda v: (not pd.isna(v)) and str(v).strip().lower().startswith("procedente")
    )
    df["responsavel"] = df["parecer_detalhado"].apply(_atribuir_responsavel)
    df["mes_referencia"] = mes_referencia

    # Coerência entre pareceres dos dois exports (procedente/improcedente).
    com_par = df[df["parecer_detalhado"].notna()]
    base_det = com_par["parecer"].str.split(" ").str[0].str.lower()
    base_norm = com_par["parecer_detalhado"].str.split(" - ").str[0].str.lower()
    divergentes = int((base_det != base_norm).sum())
    if divergentes:
        rel.avisos.append(
            f"{divergentes} registros com parecer divergente entre os dois exports "
            "(Procedente vs Improcedente) — conferir manualmente no navigate."
        )

    # Unitariedade (art. 9º): mesma ocorrência (contrato) em múltiplos canais
    # conta uma única vez DENTRO do mesmo tipo. Reclamação e ação judicial do
    # mesmo contrato são indicadores distintos e contam separadas (regra
    # validada com o fechamento real de agosto/2026). A linha duplicada é
    # mantida para rastreabilidade, apenas marcada.
    df = df.sort_values(["data_encerramento", "id"]).reset_index(drop=True)
    tem_contrato = df["numero_contrato"].notna()
    df["duplicada_unitariedade"] = False
    df.loc[tem_contrato, "duplicada_unitariedade"] = df.loc[tem_contrato].duplicated(
        subset=["cnpj_correspondente", "tipo_ocorrencia", "numero_contrato"]
    )
    rel.duplicadas_unitariedade = int(df["duplicada_unitariedade"].sum())

    # Data quality: encerramentos fora do mês de referência.
    fora = df["data_encerramento"].apply(
        lambda d: pd.isna(d)
        or d.year != mes_referencia.year
        or d.month != mes_referencia.month
    )
    rel.encerradas_fora_do_mes = int(fora.sum())
    if rel.encerradas_fora_do_mes:
        rel.avisos.append(
            f"{rel.encerradas_fora_do_mes} registros com Data de Encerramento fora "
            f"de {mes_referencia:%Y-%m} — o recorte do export está correto?"
        )

    # Data quality: dias úteis do mês sem nenhum registro (inconsistência já
    # observada pela área em extrações do navigate).
    dias_com_registro = {d.day for d in df["data_encerramento"].dropna()}
    uteis = pd.bdate_range(
        mes_referencia, (pd.Timestamp(mes_referencia) + pd.offsets.MonthEnd(0))
    )
    rel.dias_uteis_sem_registro = sorted(
        d.day for d in uteis if d.day not in dias_com_registro
    )
    if rel.dias_uteis_sem_registro:
        rel.avisos.append(
            "Dias úteis do mês sem nenhum encerramento registrado: "
            f"{rel.dias_uteis_sem_registro} — conferir se a extração está completa."
        )

    return df, rel


def agregar_mensal(df: pd.DataFrame) -> pd.DataFrame:
    """Agrega por correspondente no formato do fechamento mensal do analista.

    Reproduz exatamente o agregado usado no envio ao MCB (validado campo a
    campo contra o fechamento real de agosto/2026).
    """
    validas = df[~df["duplicada_unitariedade"]]
    linhas = []
    for cnpj, g in validas.groupby("cnpj_correspondente"):
        rec = g[g["tipo_ocorrencia"] == TIPO_RECLAMACAO]
        aj = g[g["tipo_ocorrencia"] == TIPO_ACAO_JUDICIAL]
        # Tipo mais frequente considera apenas reclamações (não ações judiciais).
        moda = rec["tipo_reclamacao"].mode()
        rpc = int(((rec["responsavel"] == "corban") & rec["procedente"]).sum())
        apc = int(((aj["responsavel"] == "corban") & aj["procedente"]).sum())
        nomes = g["nome_correspondente"].dropna()
        linhas.append({
            "mes_referencia": g["mes_referencia"].iloc[0].strftime("%Y-%m"),
            "cnpj_correspondente": cnpj,
            "nome_correspondente": nomes.iloc[0] if len(nomes) else None,
            "qtd_reclamacoes_total": len(rec),
            "qtd_reclamacoes_procedentes_corban": rpc,
            "qtd_reclamacoes_procedentes_senff": int(
                ((rec["responsavel"] == "senff") & rec["procedente"]).sum()
            ),
            "qtd_reclamacoes_indefinidas": int((rec["responsavel"] == "indefinido").sum()),
            "qtd_acoes_judiciais_total": len(aj),
            "qtd_acoes_judiciais_procedentes_corban": apc,
            "qtd_acoes_judiciais_procedentes_senff": int(
                ((aj["responsavel"] == "senff") & aj["procedente"]).sum()
            ),
            "qtd_acoes_judiciais_indefinidas": int((aj["responsavel"] == "indefinido").sum()),
            "qtd_encaminhadas_fraudes": int(g["encaminhou_fraudes"].sum()),
            "tipo_ocorrencia_mais_frequente": moda.iloc[0] if len(moda) else "",
            "numerador_indice_quadro5": rpc + apc,
        })
    return pd.DataFrame(linhas)


# ---------------------------------------------------------------------------
# Carga no Supabase (service_role — roda fora do contexto de usuário logado)
# ---------------------------------------------------------------------------

def _criar_cliente_supabase():
    from dotenv import load_dotenv
    from supabase import create_client

    load_dotenv(RAIZ_REPO / ".env")
    url = os.environ.get("SUPABASE_URL")
    chave = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not chave:
        raise SystemExit(
            "Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env na raiz) "
            "ou use --dry-run para gerar apenas os CSVs de conferência."
        )
    return create_client(url, chave)


def _texto(valor):
    return None if pd.isna(valor) else str(valor)


def _data_iso(valor):
    return valor.isoformat() if isinstance(valor, date) else None


def registro_para_banco(linha: pd.Series, correspondente_id: str, *, com_canal: bool) -> dict:
    """Mapeia a ocorrência normalizada para as colunas do schema V1 já aplicado.

    `parecer` guarda o texto mais informativo disponível: o parecer detalhado
    (Procedente/Improcedente - Corban/Senff) quando o cruzamento encontrou par,
    senão o parecer binário da exportação detalhada.
    `protocolo` guarda o Identificador da ocorrência (sempre presente na
    detalhada) — nos casos cruzados ele coincide com o Protocolo da normal.
    `origem_export` é sempre 'detalhada' porque a base motriz do mês é o
    export por data de encerramento.
    """
    parecer = linha["parecer_detalhado"] if pd.notna(linha["parecer_detalhado"]) else linha["parecer"]
    registro = {
        "correspondente_id": correspondente_id,
        "protocolo": _texto(linha["id"]),
        "cpf_cliente": _texto(linha["cpf_cliente"]),
        "cpf_agente": _texto(linha["cpf_agente"]),
        "data_ocorrencia": _data_iso(linha["data_ocorrencia"]),
        "data_encerramento": _data_iso(linha["data_encerramento"]),
        "parecer": _texto(parecer),
        "responsavel": linha["responsavel"],
        "mes_referencia": linha["mes_referencia"].isoformat(),
        "origem_export": "detalhada",
    }
    if com_canal:
        registro["canal_origem"] = _texto(linha["canal_origem"])
    return registro


def carregar_no_banco(sb, df: pd.DataFrame, agregado: pd.DataFrame, mes: date) -> None:
    """Grava ocorrências e classificação do mês. Idempotente por mês."""
    # 1. Garante os correspondentes e captura os ids.
    cnpj_para_id: dict[str, str] = {}
    for _, linha in agregado.iterrows():
        cnpj = linha["cnpj_correspondente"]
        nome_bruto = linha["nome_correspondente"]
        nome = cnpj if pd.isna(nome_bruto) or not str(nome_bruto).strip() else str(nome_bruto).strip()
        existente = (
            sb.table("correspondentes").select("id, nome").eq("cnpj", cnpj).execute()
        )
        if existente.data:
            cnpj_para_id[cnpj] = existente.data[0]["id"]
        else:
            criado = (
                sb.table("correspondentes")
                .insert({"cnpj": cnpj, "nome": nome})
                .execute()
            )
            cnpj_para_id[cnpj] = criado.data[0]["id"]

    # 2. Recarga idempotente do mês: apaga e regrava as ocorrências do mês.
    #    Duplicadas de unitariedade NÃO são gravadas (o schema V1 não tem flag
    #    para excluí-las depois); o CSV de --dry-run as mantém marcadas.
    mes_iso = mes.isoformat()
    for tabela in ("reclamacoes", "acoes_judiciais"):
        sb.table(tabela).delete().eq("mes_referencia", mes_iso).execute()

    validas = df[~df["duplicada_unitariedade"]]
    reclamacoes, acoes = [], []
    for _, linha in validas.iterrows():
        corr_id = cnpj_para_id[linha["cnpj_correspondente"]]
        if linha["tipo_ocorrencia"] == TIPO_ACAO_JUDICIAL:
            acoes.append(registro_para_banco(linha, corr_id, com_canal=False))
        else:
            reclamacoes.append(registro_para_banco(linha, corr_id, com_canal=True))
    if reclamacoes:
        sb.table("reclamacoes").insert(reclamacoes).execute()
    if acoes:
        sb.table("acoes_judiciais").insert(acoes).execute()
    log.info("Gravadas %d reclamações e %d ações judiciais.", len(reclamacoes), len(acoes))

    # 3. Classificação mensal (Quadro 5) — denominador vem de carteira_produzida.
    carteiras = (
        sb.table("carteira_produzida")
        .select("correspondente_id, operacoes_acumuladas_desde_2023")
        .eq("mes_referencia", mes_iso)
        .execute()
    )
    carteira_por_id = {
        c["correspondente_id"]: c["operacoes_acumuladas_desde_2023"]
        for c in (carteiras.data or [])
        if c.get("operacoes_acumuladas_desde_2023") is not None
    }

    classificacoes = []
    for _, a in agregado.iterrows():
        corr_id = cnpj_para_id[a["cnpj_correspondente"]]
        resultado = classificar_mensal(
            reclamacoes_procedentes_corban=int(a["qtd_reclamacoes_procedentes_corban"]),
            acoes_judiciais_procedentes_corban=int(a["qtd_acoes_judiciais_procedentes_corban"]),
            total_reclamacoes_mes=int(a["qtd_reclamacoes_total"]),
            carteira_produzida=carteira_por_id.get(corr_id),
            pendentes_indefinido=int(
                a["qtd_reclamacoes_indefinidas"] + a["qtd_acoes_judiciais_indefinidas"]
            ),
        )
        classificacoes.append({
            "correspondente_id": corr_id,
            "mes_referencia": mes_iso,
            "qtd_reclamacoes_corban": int(a["qtd_reclamacoes_procedentes_corban"]),
            "qtd_acoes_judiciais_corban": int(a["qtd_acoes_judiciais_procedentes_corban"]),
            "carteira_denominador": resultado.denominador,
            "indice": resultado.indice,
            "aplicavel": resultado.aplicavel,
            "status": resultado.status,
        })
    sb.table("classificacoes_mensais").upsert(
        classificacoes, on_conflict="correspondente_id,mes_referencia"
    ).execute()
    log.info("Classificação mensal gravada para %d correspondentes.", len(classificacoes))

    sem_carteira = [c for c in classificacoes if c["carteira_denominador"] is None]
    if sem_carteira:
        log.warning(
            "%d correspondentes sem carteira_produzida.operacoes_acumuladas_desde_2023 "
            "carregada para %s (status nao_aplicavel). Carregue o denominador e "
            "rode o ETL de novo.",
            len(sem_carteira), mes_iso,
        )


def e_procedente_corban(responsavel, parecer) -> bool:
    """Reconstrói 'procedente-Corban' a partir das colunas do schema V1."""
    if responsavel != "corban" or parecer is None:
        return False
    return str(parecer).strip().lower().startswith("procedente")


def reclassificar_mes(sb, mes: date) -> int:
    """Recalcula classificacoes_mensais a partir do que já está no banco.

    Use depois de carregar a carteira produzida, sem reimportar os CSVs do navigate.
    Inclui correspondentes que só têm carteira (zero ocorrências no mês).
    """
    mes_iso = mes.isoformat()
    rec = (
        sb.table("reclamacoes")
        .select("correspondente_id, responsavel, parecer")
        .eq("mes_referencia", mes_iso)
        .execute()
        .data
        or []
    )
    aj = (
        sb.table("acoes_judiciais")
        .select("correspondente_id, responsavel, parecer")
        .eq("mes_referencia", mes_iso)
        .execute()
        .data
        or []
    )
    carteiras = (
        sb.table("carteira_produzida")
        .select("correspondente_id, operacoes_acumuladas_desde_2023")
        .eq("mes_referencia", mes_iso)
        .execute()
        .data
        or []
    )
    carteira_por_id = {
        c["correspondente_id"]: c["operacoes_acumuladas_desde_2023"]
        for c in carteiras
        if c.get("operacoes_acumuladas_desde_2023") is not None
    }

    ids = {r["correspondente_id"] for r in rec} | {a["correspondente_id"] for a in aj} | set(carteira_por_id)
    classificacoes = []
    for corr_id in ids:
        rec_c = [r for r in rec if r["correspondente_id"] == corr_id]
        aj_c = [a for a in aj if a["correspondente_id"] == corr_id]
        rpc = sum(1 for r in rec_c if e_procedente_corban(r.get("responsavel"), r.get("parecer")))
        apc = sum(1 for a in aj_c if e_procedente_corban(a.get("responsavel"), a.get("parecer")))
        indefinidas = sum(1 for r in rec_c if r.get("responsavel") == "indefinido") + sum(
            1 for a in aj_c if a.get("responsavel") == "indefinido"
        )
        resultado = classificar_mensal(
            reclamacoes_procedentes_corban=rpc,
            acoes_judiciais_procedentes_corban=apc,
            total_reclamacoes_mes=len(rec_c),
            carteira_produzida=carteira_por_id.get(corr_id),
            pendentes_indefinido=indefinidas,
        )
        classificacoes.append({
            "correspondente_id": corr_id,
            "mes_referencia": mes_iso,
            "qtd_reclamacoes_corban": rpc,
            "qtd_acoes_judiciais_corban": apc,
            "carteira_denominador": resultado.denominador,
            "indice": resultado.indice,
            "aplicavel": resultado.aplicavel,
            "status": resultado.status,
        })
    if classificacoes:
        sb.table("classificacoes_mensais").upsert(
            classificacoes, on_conflict="correspondente_id,mes_referencia"
        ).execute()
    log.info("Reclassificação do mês %s: %d correspondentes.", mes_iso, len(classificacoes))
    return len(classificacoes)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--detalhada", help="CSV da exportação detalhada")
    parser.add_argument("--normal", help="CSV da exportação normal (reclamações)")
    parser.add_argument("--mes", required=True, help="Mês de referência, formato YYYY-MM")
    parser.add_argument(
        "--reclassificar",
        action="store_true",
        help="Só recalcula classificacoes_mensais a partir do banco (sem reler os CSVs)",
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Não grava no banco; gera CSVs de conferência em --saida")
    parser.add_argument("--saida", default="saida_etl",
                        help="Pasta dos CSVs de conferência no --dry-run")
    args = parser.parse_args()

    try:
        ano, mes_num = map(int, args.mes.split("-"))
        mes = date(ano, mes_num, 1)
    except ValueError:
        raise SystemExit(f"--mes inválido: {args.mes!r}. Use YYYY-MM, ex.: 2026-08")

    if args.reclassificar:
        sb = _criar_cliente_supabase()
        n = reclassificar_mes(sb, mes)
        log.info("Reclassificação concluída (%d correspondentes).", n)
        return

    if not args.detalhada or not args.normal:
        raise SystemExit("Informe --detalhada e --normal, ou use --reclassificar.")

    detalhada = carregar_detalhada(args.detalhada)
    normal = carregar_normal(args.normal)
    df, rel = transformar(detalhada, normal, mes)
    agregado = agregar_mensal(df)

    log.info(
        "Mês %s: %d ocorrências encerradas (%d reclamações, %d ações judiciais), "
        "%d correspondentes.",
        args.mes,
        len(df),
        (df["tipo_ocorrencia"] == TIPO_RECLAMACAO).sum(),
        (df["tipo_ocorrencia"] == TIPO_ACAO_JUDICIAL).sum(),
        agregado.shape[0],
    )
    for aviso in rel.avisos:
        log.warning(aviso)

    if args.dry_run:
        saida = Path(args.saida)
        saida.mkdir(parents=True, exist_ok=True)
        df.to_csv(saida / f"ocorrencias_{args.mes}.csv", sep=";", index=False)
        agregado.to_csv(saida / f"agregado_mensal_{args.mes}.csv", sep=";", index=False)
        log.info("Dry-run: CSVs de conferência gravados em %s (nada foi enviado ao banco).", saida)
        return

    sb = _criar_cliente_supabase()
    carregar_no_banco(sb, df, agregado, mes)
    log.info("Carga concluída para %s.", args.mes)


if __name__ == "__main__":
    main()
