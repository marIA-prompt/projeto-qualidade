-- ============================================================================
-- Plano de Qualidade de Correspondentes — Banco Senff
-- Schema Postgres (Supabase) + Row-Level Security
--
-- Como usar: cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- É idempotente (pode ser re-executado sem quebrar).
--
-- Papéis de acesso:
--   * staff          -> área de Qualidade/Compliance, acesso total via RLS.
--   * correspondente -> vê apenas as linhas do seu próprio correspondente_id.
--   * service_role   -> usada SOMENTE pelo ETL (bypassa RLS por padrão).
--
-- Referências normativas: arts. 50-55 e 69-70 do Normativo Correlato;
-- art. 5º (Quadro 3) e art. 9º (Quadro 5) do Anexo I.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabelas núcleo
-- ----------------------------------------------------------------------------

create table if not exists public.correspondentes (
    id          uuid primary key default gen_random_uuid(),
    cnpj        text not null unique,
    nome        text not null,
    ativo       boolean not null default true,
    criado_em   timestamptz not null default now()
);

comment on table public.correspondentes is
    'Rede de correspondentes bancários monitorada pelo Plano de Qualidade.';

-- Mapeia usuários do Supabase Auth para papel de acesso.
create table if not exists public.perfis (
    user_id           uuid primary key references auth.users (id) on delete cascade,
    papel             text not null check (papel in ('staff', 'correspondente')),
    correspondente_id uuid references public.correspondentes (id),
    criado_em         timestamptz not null default now(),
    constraint correspondente_exige_vinculo
        check (papel <> 'correspondente' or correspondente_id is not null)
);

comment on table public.perfis is
    'Perfil de acesso: staff (Qualidade/Compliance) ou correspondente (vê só o próprio).';

-- ----------------------------------------------------------------------------
-- 2. Ocorrências (origem: exports do navigate, gravadas pelo ETL)
--    reclamacoes e acoes_judiciais têm a mesma estrutura; a separação em duas
--    tabelas segue a exigência de indicadores segregados (art. 51, II).
-- ----------------------------------------------------------------------------

create table if not exists public.reclamacoes (
    id                     uuid primary key,          -- Identificador da ocorrência (navigate)
    correspondente_id      uuid not null references public.correspondentes (id),
    mes_referencia         date not null,             -- 1º dia do mês de encerramento
    protocolo              text,                      -- Protocolo do export normal (quando cruzou)
    canal_origem           text,                      -- Setor Origem (Procon, Bacen, Ouvidoria...)
    tipo_reclamacao        text,                      -- classificação já feita no navigate
    parecer                text,                      -- export detalhado: Procedente/Improcedente
    parecer_detalhado      text,                      -- export normal: Procedente/Improcedente - Corban/Senff
    procedente             boolean not null default false,
    -- Atribuição de responsabilidade (art. 53): só conta contra o correspondente
    -- quando 'corban'. 'indefinido' = sem par no export normal do mês (caso
    -- aberto em mês anterior) — NUNCA entra no índice sem confirmação manual.
    responsavel            text not null check (responsavel in ('corban', 'senff', 'indefinido')),
    -- Regra de unitariedade (art. 9º): mesma ocorrência/contrato em múltiplos
    -- canais conta uma única vez. A linha duplicada é mantida para rastreabilidade,
    -- mas marcada aqui e excluída das agregações.
    duplicada_unitariedade boolean not null default false,
    encaminhou_fraudes     boolean not null default false,
    numero_contrato        text,
    cpf_cliente            text,                      -- dado pessoal: não expor ao correspondente
    nome_cliente           text,                      -- dado pessoal: não expor ao correspondente
    cpf_agente             text,
    data_ocorrencia        date,
    data_cadastro          date,
    data_encerramento      date,
    importado_em           timestamptz not null default now()
);

create index if not exists idx_reclamacoes_corr_mes
    on public.reclamacoes (correspondente_id, mes_referencia);

create table if not exists public.acoes_judiciais (
    id                     uuid primary key,
    correspondente_id      uuid not null references public.correspondentes (id),
    mes_referencia         date not null,
    protocolo              text,
    canal_origem           text,
    tipo_reclamacao        text,
    parecer                text,
    parecer_detalhado      text,
    procedente             boolean not null default false,
    responsavel            text not null check (responsavel in ('corban', 'senff', 'indefinido')),
    duplicada_unitariedade boolean not null default false,
    encaminhou_fraudes     boolean not null default false,
    numero_contrato        text,
    cpf_cliente            text,
    nome_cliente           text,
    cpf_agente             text,
    data_ocorrencia        date,
    data_cadastro          date,
    data_encerramento      date,
    importado_em           timestamptz not null default now()
);

create index if not exists idx_acoes_judiciais_corr_mes
    on public.acoes_judiciais (correspondente_id, mes_referencia);

-- ----------------------------------------------------------------------------
-- 3. Auditorias (art. 51, I) — entrada manual na V1, automação é Fase 2
-- ----------------------------------------------------------------------------

create table if not exists public.auditorias_externas (
    id                uuid primary key default gen_random_uuid(),
    correspondente_id uuid not null references public.correspondentes (id),
    data_auditoria    date not null,
    pilar             text not null check (pilar in
                          ('tecnologia_informacao', 'lgpd', 'relacionamento_cliente',
                           'governanca', 'treinamento')),
    pontuacao         numeric(5, 2),
    observacoes       text,
    criado_em         timestamptz not null default now()
);

create table if not exists public.auditorias_internas (
    id                uuid primary key default gen_random_uuid(),
    correspondente_id uuid not null references public.correspondentes (id),
    data_auditoria    date not null,
    pilar             text not null check (pilar in
                          ('tecnologia_informacao', 'lgpd', 'relacionamento_cliente',
                           'governanca', 'treinamento')),
    pontuacao         numeric(5, 2),
    observacoes       text,
    criado_em         timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. Carteira produzida (denominador do índice do Quadro 5)
--    Fonte real ainda não confirmada — ingestão manual (planilha) até lá.
--    Sem linha carregada para o correspondente/mês, o motor devolve
--    status 'nao_aplicavel' (nunca assume zero).
-- ----------------------------------------------------------------------------

create table if not exists public.carteira_produzida (
    id                   uuid primary key default gen_random_uuid(),
    correspondente_id    uuid not null references public.correspondentes (id),
    mes_referencia       date not null,
    -- operações acumuladas desde jan/2023 (art. 9º do Anexo I)
    operacoes_acumuladas integer not null check (operacoes_acumuladas >= 0),
    fonte                text not null default 'manual',
    criado_em            timestamptz not null default now(),
    unique (correspondente_id, mes_referencia)
);

-- ----------------------------------------------------------------------------
-- 5. Classificações
-- ----------------------------------------------------------------------------

create table if not exists public.classificacoes_mensais (
    id                             uuid primary key default gen_random_uuid(),
    correspondente_id              uuid not null references public.correspondentes (id),
    mes_referencia                 date not null,
    qtd_reclamacoes                integer not null default 0,
    qtd_reclamacoes_corban         integer not null default 0,
    qtd_acoes_judiciais            integer not null default 0,
    qtd_acoes_judiciais_corban     integer not null default 0,
    qtd_indefinidas                integer not null default 0,   -- pendentes de confirmação
    tipo_ocorrencia_mais_frequente text,
    numerador                      integer not null default 0,   -- procedentes-Corban (recl. + ações)
    denominador                    integer,                      -- carteira produzida; null = não carregado
    indice                         numeric(10, 6),               -- numerador/denominador; null se não aplicável
    aplicavel                      boolean not null default false,
    status                         text not null check (status in
                                       ('conforme', 'nao_conforme', 'nao_aplicavel')),
    motivo                         text,
    calculado_em                   timestamptz not null default now(),
    unique (correspondente_id, mes_referencia)
);

comment on table public.classificacoes_mensais is
    'Resultado do Quadro 5 (art. 9º, Anexo I) calculado pelo motor_classificacao.';

-- Estrutura mínima para a Fase 2 (Quadro 3, art. 5º do Anexo I).
create table if not exists public.classificacoes_anuais (
    id                    uuid primary key default gen_random_uuid(),
    correspondente_id     uuid not null references public.correspondentes (id),
    ano                   integer not null,
    pontuacao_geral       numeric(5, 2),
    desvio_conduta_grave  boolean not null default false,
    status                text check (status in
                              ('conforme', 'parcialmente_conforme', 'em_atencao', 'nao_conforme')),
    calculado_em          timestamptz not null default now(),
    unique (correspondente_id, ano)
);

-- ----------------------------------------------------------------------------
-- 6. Agentes de Crédito (Fase 2 — FR-12; tabela criada agora para o vínculo)
-- ----------------------------------------------------------------------------

create table if not exists public.agentes_credito (
    id                uuid primary key default gen_random_uuid(),
    correspondente_id uuid not null references public.correspondentes (id),
    cpf               text not null,
    nome              text,
    criado_em         timestamptz not null default now(),
    unique (correspondente_id, cpf)
);

-- ----------------------------------------------------------------------------
-- 7. Medidas administrativas (FR-11) — escala própria do Banco Senff (6 níveis)
-- ----------------------------------------------------------------------------

create table if not exists public.medidas_administrativas (
    id        smallint primary key,
    nivel     smallint not null unique check (nivel between 1 and 6),
    descricao text not null
);

insert into public.medidas_administrativas (id, nivel, descricao) values
    (1, 1, 'Advertência'),
    (2, 2, 'Suspensão de 5 dias úteis'),
    (3, 3, 'Suspensão de 10 dias úteis'),
    (4, 4, 'Suspensão de 20 dias úteis'),
    (5, 5, 'Suspensão de 30 dias úteis'),
    (6, 6, 'Suspensão definitiva')
on conflict (id) do update set nivel = excluded.nivel, descricao = excluded.descricao;

create table if not exists public.medidas_aplicadas (
    id                uuid primary key default gen_random_uuid(),
    correspondente_id uuid not null references public.correspondentes (id),
    medida_id         smallint not null references public.medidas_administrativas (id),
    mes_referencia    date not null,
    aplicada_em       date not null default current_date,
    motivo            text,
    registrado_por    uuid references auth.users (id) default auth.uid(),
    criado_em         timestamptz not null default now()
);

comment on table public.medidas_aplicadas is
    'Registro manual (ato humano da Gestora de Qualidade) da medida aplicada — o sistema nunca decide sozinho.';

-- ----------------------------------------------------------------------------
-- 8. Trilha de auditoria (art. 70 — retenção mínima de 5 anos p/ casos de fraude)
--    Não há rotina de purga: nada é apagado automaticamente.
-- ----------------------------------------------------------------------------

create table if not exists public.log_alteracoes (
    id           bigint generated always as identity primary key,
    tabela       text not null,
    operacao     text not null,
    registro_id  text,
    dados_antes  jsonb,
    dados_depois jsonb,
    usuario      uuid default auth.uid(),
    executado_em timestamptz not null default now()
);

create or replace function public.fn_log_alteracoes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.log_alteracoes (tabela, operacao, registro_id, dados_antes, dados_depois)
    values (
        tg_table_name,
        tg_op,
        coalesce((to_jsonb(coalesce(new, old)) ->> 'id'), null),
        case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
        case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
    );
    return coalesce(new, old);
end;
$$;

do $$
declare
    t text;
begin
    foreach t in array array[
        'reclamacoes', 'acoes_judiciais', 'carteira_produzida',
        'classificacoes_mensais', 'classificacoes_anuais',
        'medidas_aplicadas', 'auditorias_externas', 'auditorias_internas'
    ]
    loop
        execute format('drop trigger if exists trg_log_%I on public.%I', t, t);
        execute format(
            'create trigger trg_log_%I after insert or update or delete on public.%I
             for each row execute function public.fn_log_alteracoes()', t, t);
    end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Funções auxiliares de RLS
--    security definer para não recursionar na RLS da própria tabela perfis.
-- ----------------------------------------------------------------------------

create or replace function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select papel from public.perfis where user_id = auth.uid();
$$;

create or replace function public.correspondente_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select correspondente_id from public.perfis where user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 10. Row-Level Security
--     service_role (ETL) bypassa RLS por padrão no Supabase.
-- ----------------------------------------------------------------------------

alter table public.correspondentes         enable row level security;
alter table public.perfis                  enable row level security;
alter table public.reclamacoes             enable row level security;
alter table public.acoes_judiciais         enable row level security;
alter table public.auditorias_externas     enable row level security;
alter table public.auditorias_internas     enable row level security;
alter table public.carteira_produzida      enable row level security;
alter table public.classificacoes_mensais  enable row level security;
alter table public.classificacoes_anuais   enable row level security;
alter table public.agentes_credito         enable row level security;
alter table public.medidas_administrativas enable row level security;
alter table public.medidas_aplicadas       enable row level security;
alter table public.log_alteracoes          enable row level security;

-- perfis: cada usuário lê o próprio perfil; staff lê/gerencia todos.
drop policy if exists perfis_proprio on public.perfis;
create policy perfis_proprio on public.perfis
    for select using (user_id = auth.uid());

drop policy if exists perfis_staff on public.perfis;
create policy perfis_staff on public.perfis
    for all using (public.papel_atual() = 'staff')
    with check (public.papel_atual() = 'staff');

-- medidas_administrativas: lookup público para qualquer usuário autenticado.
drop policy if exists medidas_adm_leitura on public.medidas_administrativas;
create policy medidas_adm_leitura on public.medidas_administrativas
    for select to authenticated using (true);

-- log_alteracoes: somente staff lê; escrita só via trigger (security definer).
drop policy if exists log_staff_leitura on public.log_alteracoes;
create policy log_staff_leitura on public.log_alteracoes
    for select using (public.papel_atual() = 'staff');

-- Demais tabelas: staff acesso total; correspondente somente leitura das
-- próprias linhas (FR-6: nenhum correspondente vê dados de outro).
do $$
declare
    t text;
begin
    foreach t in array array[
        'reclamacoes', 'acoes_judiciais', 'auditorias_externas',
        'auditorias_internas', 'carteira_produzida', 'classificacoes_mensais',
        'classificacoes_anuais', 'agentes_credito', 'medidas_aplicadas'
    ]
    loop
        execute format('drop policy if exists %I_staff_total on public.%I', t, t);
        execute format(
            'create policy %I_staff_total on public.%I
             for all using (public.papel_atual() = ''staff'')
             with check (public.papel_atual() = ''staff'')', t, t);

        execute format('drop policy if exists %I_corr_leitura on public.%I', t, t);
        execute format(
            'create policy %I_corr_leitura on public.%I
             for select using (
                 public.papel_atual() = ''correspondente''
                 and correspondente_id = public.correspondente_atual()
             )', t, t);
    end loop;
end;
$$;

-- correspondentes: staff total; correspondente enxerga apenas a si mesmo.
drop policy if exists correspondentes_staff_total on public.correspondentes;
create policy correspondentes_staff_total on public.correspondentes
    for all using (public.papel_atual() = 'staff')
    with check (public.papel_atual() = 'staff');

drop policy if exists correspondentes_corr_leitura on public.correspondentes;
create policy correspondentes_corr_leitura on public.correspondentes
    for select using (
        public.papel_atual() = 'correspondente'
        and id = public.correspondente_atual()
    );

-- ============================================================================
-- Pós-instalação (manual):
-- 1. Crie os usuários em Authentication > Users.
-- 2. Insira o perfil de cada usuário, por exemplo:
--    insert into public.perfis (user_id, papel) values ('<uuid-do-usuario>', 'staff');
--    insert into public.perfis (user_id, papel, correspondente_id)
--        values ('<uuid>', 'correspondente', '<uuid-do-correspondente>');
-- 3. Nota LGPD: cpf_cliente/nome_cliente ficam protegidos por RLS de linha;
--    o dashboard não exibe esses campos ao papel correspondente (minimização).
-- ============================================================================
