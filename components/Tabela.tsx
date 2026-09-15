"use client";

import { isValidElement, useMemo, useState, type ReactNode } from "react";
import {
  LINHAS_POR_PAGINA,
  fatiarPagina,
  ordenarLinhas,
  totalPaginas,
} from "@/lib/tabela";

function valorOrdenavel(valor: unknown): unknown {
  if (isValidElement(valor)) {
    const props = valor.props as { children?: unknown; status?: string };
    if (props.children != null) return valorOrdenavel(props.children);
    if (props.status) return props.status;
    return "";
  }
  return valor;
}

export function Tabela({
  colunas,
  linhas,
  onLinha,
}: {
  colunas: { chave: string; titulo: string }[];
  linhas: Record<string, unknown>[];
  onLinha?: (linha: Record<string, unknown>) => void;
}) {
  const [chave, setChave] = useState<string | null>(null);
  const [direcao, setDirecao] = useState<"asc" | "desc">("asc");
  const [pagina, setPagina] = useState(1);

  const preparadas = useMemo(
    () =>
      linhas.map((row) => {
        const ordenacao: Record<string, unknown> = {};
        for (const col of colunas) {
          ordenacao[col.chave] = valorOrdenavel(row[col.chave]);
        }
        return { row, ordenacao };
      }),
    [linhas, colunas],
  );

  const ordenadas = useMemo(() => {
    const seq = ordenarLinhas(
      preparadas.map((p, i) => ({ ...p.ordenacao, __i: i })),
      chave,
      direcao,
    );
    return seq.map((s) => preparadas[s.__i as number].row);
  }, [preparadas, chave, direcao]);

  const paginas = totalPaginas(ordenadas.length);
  const paginaAtual = Math.min(Math.max(1, pagina), paginas);
  const visiveis = fatiarPagina(ordenadas, paginaAtual);
  const inicio = ordenadas.length === 0 ? 0 : (paginaAtual - 1) * LINHAS_POR_PAGINA + 1;
  const fim = Math.min(paginaAtual * LINHAS_POR_PAGINA, ordenadas.length);

  function clicarColuna(nova: string) {
    if (chave === nova) {
      setDirecao((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setChave(nova);
      setDirecao("asc");
    }
    setPagina(1);
  }

  return (
    <div className="overflow-auto rounded-[var(--radius-box)] border border-[var(--border)] bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[var(--senff-light-grey)] text-[var(--senff-navy-text)]">
          <tr>
            {colunas.map((c) => {
              const ativa = chave === c.chave;
              const ariaSort = !ativa ? "none" : direcao === "asc" ? "ascending" : "descending";
              return (
                <th key={c.chave} className="px-3 py-2 font-semibold" aria-sort={ariaSort}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 bg-transparent p-0 text-left font-semibold hover:text-[var(--senff-acqua)]"
                    onClick={() => clicarColuna(c.chave)}
                  >
                    {c.titulo}
                    <span className="text-xs text-[var(--senff-grey)]" aria-hidden>
                      {ativa ? (direcao === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visiveis.length ? (
            visiveis.map((row, i) => (
              <tr
                key={i}
                className={`border-t border-[var(--border)] ${
                  onLinha ? "cursor-pointer hover:bg-[#e8f7fb]" : ""
                }`}
                tabIndex={onLinha ? 0 : undefined}
                onClick={onLinha ? () => onLinha(row) : undefined}
                onKeyDown={
                  onLinha
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onLinha(row);
                        }
                      }
                    : undefined
                }
              >
                {colunas.map((c) => (
                  <td key={c.chave} className="px-3 py-2 align-top">
                    {row[c.chave] as ReactNode}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-4 text-[var(--senff-grey)]" colSpan={colunas.length}>
                Nenhum registro nesta tabela.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {ordenadas.length > LINHAS_POR_PAGINA ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-3 py-2 text-sm text-[var(--senff-navy-text)]">
          <span>
            {inicio}–{fim} de {ordenadas.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-[var(--radius-form)] border border-[var(--border)] bg-white px-3 py-1 disabled:opacity-40"
              disabled={paginaAtual <= 1}
              onClick={() => setPagina(paginaAtual - 1)}
            >
              Anterior
            </button>
            <span>
              Página {paginaAtual} de {paginas}
            </span>
            <button
              type="button"
              className="rounded-[var(--radius-form)] border border-[var(--border)] bg-white px-3 py-1 disabled:opacity-40"
              disabled={paginaAtual >= paginas}
              onClick={() => setPagina(paginaAtual + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
