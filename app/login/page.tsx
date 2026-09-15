import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--senff-light-grey)] p-6">
      <div className="w-full max-w-md">
        <div className="mb-5 rounded-[var(--radius-box)] bg-[var(--senff-navy)] p-6 text-center text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-senff-branca.png" alt="Banco Senff" className="mx-auto mb-3 h-12 w-auto" />
          <h1 className="text-xl font-semibold">Plano de Qualidade de Correspondentes</h1>
          <p className="mt-1 text-sm text-white/80">
            Banco Senff · Autorregulação do Crédito Consignado (FEBRABAN)
          </p>
        </div>
        <div className="rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
