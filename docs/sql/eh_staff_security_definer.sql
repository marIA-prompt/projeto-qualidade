-- Patch das funções auxiliares de RLS (já aplicado no projeto Supabase).
-- Sem SECURITY DEFINER, eh_staff() lê `perfis` cuja policy chama eh_staff()
-- de novo → "stack depth limit exceeded".

create or replace function public.eh_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.perfis
        where id = auth.uid() and role = 'staff'
    );
$$;

create or replace function public.meu_correspondente_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select correspondente_id from public.perfis where id = auth.uid();
$$;

revoke all on function public.eh_staff() from public;
revoke all on function public.meu_correspondente_id() from public;
grant execute on function public.eh_staff() to authenticated;
grant execute on function public.meu_correspondente_id() to authenticated;
