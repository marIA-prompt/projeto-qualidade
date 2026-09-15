"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function GraficoLinha({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: { key: string; color: string }[];
}) {
  return (
    <div className="h-72 w-full rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-3">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4ebf0" />
          <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficoBarras({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: { key: string; color: string }[];
}) {
  return (
    <div className="h-72 w-full rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-3">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4ebf0" />
          <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={s.color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
