"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--senff-light-grey)] p-6">
      <div className="w-full max-w-md rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-6 text-center">
        <h1 className="text-xl font-semibold text-[var(--senff-navy)]">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-[var(--senff-navy-text)]">
          O painel encontrou um erro no servidor. Entre de novo pela tela de login
          ou tente recarregar.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-[var(--senff-grey)]">Ref. {error.digest}</p>
        ) : null}
        <div className="mt-4 flex justify-center gap-3">
          <a
            href="/login"
            className="rounded-[var(--radius-form)] bg-[var(--senff-acqua)] px-4 py-2 text-sm font-semibold text-white"
          >
            Ir para o login
          </a>
          <button
            type="button"
            onClick={reset}
            className="rounded-[var(--radius-form)] border border-[var(--border)] px-4 py-2 text-sm"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    </main>
  );
}
