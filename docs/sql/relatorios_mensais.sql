-- Relatórios mensais gerados/enviados pelo painel (já aplicado no projeto).

create table if not exists public.relatorios_mensais (
    id uuid primary key default gen_random_uuid(),
    mes_referencia date,
    correspondente_id uuid references public.correspondentes(id),
    destinatario text not null,
    assunto text not null,
    corpo text not null,
    status text not null check (status in ('gerado', 'enviado', 'falhou')),
    erro text,
    enviado_por uuid references auth.users(id),
    created_at timestamptz not null default now()
);

alter table public.relatorios_mensais enable row level security;

drop policy if exists staff_le_relatorios on public.relatorios_mensais;
create policy staff_le_relatorios on public.relatorios_mensais
    for select using (public.eh_staff());

drop policy if exists staff_escreve_relatorios on public.relatorios_mensais;
create policy staff_escreve_relatorios on public.relatorios_mensais
    for insert with check (public.eh_staff());
