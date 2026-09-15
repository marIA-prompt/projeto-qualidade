# Painel Next.js (Vercel)

Painel do Plano de Qualidade reescrito em **Next.js** para preview/deploy na
Vercel. O ETL Python e o `motor_classificacao` continuam a fonte da carga
mensal; este app só lê o Postgres via **anon key + JWT** (RLS).

## Variáveis

Copie `.env.example` para `.env.local`. Só `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Não** coloque `service_role`.

## Local

```bash
cd web
npm install
npm run dev
```

Abre `http://localhost:3000`. Login: `maria.morais@senff.com.br`.

## Vercel (passo)

1. Acesse [vercel.com](https://vercel.com) e entre com GitHub.
2. **Add New → Project** → `marIA-prompt/projeto-qualidade`.
3. **Root Directory:** `web`.
4. Framework Preset: Next.js (detectado).
5. Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Deploy. Cada PR ganha URL `*.vercel.app`.
7. No Supabase: Authentication → URL Configuration → adicione a URL da Vercel
   em **Site URL** / **Redirect URLs** (`https://seu-projeto.vercel.app/**`).

O login continua o do Auth (não há autologin). SMTP é opcional (`SMTP_*`).
