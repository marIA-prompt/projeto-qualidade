-- Checkbox + data da aba Relacionamento (conversa e fila de acompanhamento).
-- Incremental: não recria o schema V1.

create table if not exists public.acompanhamento_acoes (
    id uuid primary key default gen_random_uuid(),
    correspondente_id uuid not null references public.correspondentes(id),
    mes_referencia date not null,
    chave text not null,
    acao_realizada boolean not null default false,
    data_acao date,
    atualizado_por uuid references auth.users(id),
    atualizado_em timestamptz not null default now(),
    unique (correspondente_id, mes_referencia, chave)
);

alter table public.acompanhamento_acoes enable row level security;

drop policy if exists select_acompanhamento_acoes on public.acompanhamento_acoes;
create policy select_acompanhamento_acoes on public.acompanhamento_acoes for select
    using (public.eh_staff() or correspondente_id = public.meu_correspondente_id());

drop policy if exists staff_escreve_acompanhamento_acoes on public.acompanhamento_acoes;
create policy staff_escreve_acompanhamento_acoes on public.acompanhamento_acoes for all
    using (public.eh_staff()) with check (public.eh_staff());

grant select, insert, update on public.acompanhamento_acoes to authenticated;
