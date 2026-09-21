"use client";

export function SeletorAno({ ano, anos }: { ano: number; anos: number[] }) {
  if (!anos.length) {
    return <p className="text-sm text-[var(--senff-grey)]">Ciclo {ano}</p>;
  }
  return (
    <label className="text-sm">
      Ano
      <select
        className="ml-2 rounded-[var(--radius-form)] border border-[var(--border)] px-3 py-2"
        defaultValue={String(ano)}
        onChange={(e) => {
          const p = new URLSearchParams(window.location.search);
          p.set("ano", e.target.value);
          window.location.search = p.toString();
        }}
      >
        {anos.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </label>
  );
}
