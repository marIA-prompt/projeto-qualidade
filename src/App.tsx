import { useEffect, useState, type FormEvent } from "react";
import type {
  QualityCheck,
  QualityStatus,
  QualitySummary,
} from "../shared/types.ts";
import { createCheck, fetchChecks } from "./api.ts";
import "./App.css";

const EMPTY_SUMMARY: QualitySummary = {
  total: 0,
  passed: 0,
  failed: 0,
  pending: 0,
  passRate: 0,
};

const STATUS_LABELS: Record<QualityStatus, string> = {
  pending: "Pendente",
  passed: "Aprovado",
  failed: "Reprovado",
};

export default function App() {
  const [checks, setChecks] = useState<QualityCheck[]>([]);
  const [summary, setSummary] = useState<QualitySummary>(EMPTY_SUMMARY);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState<QualityStatus>("pending");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const data = await fetchChecks();
      setChecks(data.checks);
      setSummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createCheck({ title, area, status, notes });
      setTitle("");
      setArea("");
      setStatus("pending");
      setNotes("");
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar verificação");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>Projeto Qualidade</h1>
        <p>Registre e acompanhe verificações de qualidade.</p>
      </header>

      <section className="summary" aria-label="Resumo">
        <div className="summary__card">
          <span className="summary__value">{summary.total}</span>
          <span className="summary__label">Total</span>
        </div>
        <div className="summary__card summary__card--passed">
          <span className="summary__value">{summary.passed}</span>
          <span className="summary__label">Aprovados</span>
        </div>
        <div className="summary__card summary__card--failed">
          <span className="summary__value">{summary.failed}</span>
          <span className="summary__label">Reprovados</span>
        </div>
        <div className="summary__card summary__card--pending">
          <span className="summary__value">{summary.pending}</span>
          <span className="summary__label">Pendentes</span>
        </div>
        <div className="summary__card summary__card--rate">
          <span className="summary__value">{summary.passRate}%</span>
          <span className="summary__label">Taxa de aprovação</span>
        </div>
      </section>

      <form className="form" onSubmit={handleSubmit}>
        <h2>Nova verificação</h2>
        <div className="form__row">
          <label>
            Título
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Inspeção do lote 43"
              required
            />
          </label>
          <label>
            Área
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Ex.: Produção"
              required
            />
          </label>
        </div>
        <div className="form__row">
          <label>
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as QualityStatus)}
            >
              <option value="pending">Pendente</option>
              <option value="passed">Aprovado</option>
              <option value="failed">Reprovado</option>
            </select>
          </label>
          <label className="form__notes">
            Observações
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
            />
          </label>
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : "Adicionar verificação"}
        </button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      <section className="list" aria-label="Verificações">
        <h2>Verificações registradas</h2>
        {loading ? (
          <p>Carregando...</p>
        ) : checks.length === 0 ? (
          <p className="empty">Nenhuma verificação registrada ainda.</p>
        ) : (
          <ul>
            {checks.map((check) => (
              <li key={check.id} className={`check check--${check.status}`}>
                <div className="check__main">
                  <span className="check__title">{check.title}</span>
                  <span className="check__area">{check.area}</span>
                </div>
                {check.notes && <p className="check__notes">{check.notes}</p>}
                <span className={`badge badge--${check.status}`}>
                  {STATUS_LABELS[check.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
