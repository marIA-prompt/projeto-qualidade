export function ConfiguracaoAusente() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--senff-light-grey)] p-6">
      <div className="w-full max-w-lg rounded-[var(--radius-box)] border border-[var(--border)] bg-white p-6">
        <h1 className="text-xl font-semibold text-[var(--senff-navy)]">
          Falta configurar o Supabase neste deploy
        </h1>
        <p className="mt-3 text-sm text-[var(--senff-navy-text)]">
          O painel subiu, mas as variáveis <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> não estão disponíveis neste
          ambiente da Vercel. Sem elas o login não consegue falar com o Auth.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--senff-navy-text)]">
          <li>
            Em Vercel → Project → Settings → Environment Variables, cadastre as duas
            chaves em Production e Preview (é a anon key, nunca a service_role).
          </li>
          <li>Redeploy o projeto para o Next.js enxergar as variáveis no build.</li>
          <li>
            No Supabase → Authentication → URL Configuration, acrescente a URL
            de produção do projeto e <code>https://*.vercel.app/**</code>.
          </li>
        </ol>
      </div>
    </main>
  );
}
