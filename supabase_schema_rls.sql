-- =====================================================================
-- Plano de Qualidade de Correspondentes — Schema V1 + RLS
--
-- FONTE DE VERDADE do banco já aplicado no projeto Supabase.
-- NÃO reexecutar este arquivo em um projeto que já tem as tabelas
-- (os CREATE TABLE não são IF NOT EXISTS e vão falhar).
-- Mantenha este arquivo alinhado com o SQL Editor; o ETL e o dashboard
-- mapeiam exatamente estas colunas.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. CORRESPONDENTES (entidade raiz)
-- ---------------------------------------------------------------------
create table public.correspondentes (
    id          uuid primary key default gen_random_uuid(),
    nome        text not null,
    cnpj        text not null unique,
    ativo       boolean not null default true,
    created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. PERFIS — mapeia usuários do Supabase Auth para papel + correspondente
--    staff        => acesso total (Qualidade/Compliance)
--    correspondente => acesso restrito ao próprio correspondente_id
-- ---------------------------------------------------------------------
create table public.perfis (
    id                 uuid primary key references auth.users(id) on delete cascade,
    role               text not null check (role in ('staff', 'correspondente')),
    correspondente_id  uuid references public.correspondentes(id),
    created_at         timestamptz not null default now(),
    constraint correspondente_precisa_de_vinculo
        check (role = 'staff' or correspondente_id is not null)
);

-- Funções auxiliares usadas nas policies (stable = cacheável na mesma query)
create or replace function public.eh_staff()
returns boolean language sql stable as $$
    select exists (
        select 1 from public.perfis
        where id = auth.uid() and role = 'staff'
    );
$$;

create or replace function public.meu_correspondente_id()
returns uuid language sql stable as $$
    select correspondente_id from public.perfis where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 3. RECLAMAÇÕES  (indicador obrigatório 1)
-- ---------------------------------------------------------------------
create table public.reclamacoes (
    id                 uuid primary key default gen_random_uuid(),
    correspondente_id  uuid not null references public.correspondentes(id),
    protocolo          text,
    canal_origem       text,                 -- Setor Origem: SAC, WhatsApp, Ouvidoria, etc.
    cpf_cliente        text,
    cpf_agente         text,
    data_ocorrencia    date,
    data_encerramento  date,
    parecer            text,                 -- texto bruto do export
    responsavel        text check (responsavel in ('corban', 'senff', 'indefinido')),
    mes_referencia     date not null,        -- normalizado para o dia 1 do mês
    origem_export      text check (origem_export in ('normal', 'detalhada')),
    created_at         timestamptz not null default now()
);
create index on public.reclamacoes (correspondente_id, mes_referencia);

-- ---------------------------------------------------------------------
-- 4. AÇÕES JUDICIAIS  (indicador obrigatório 2)
-- ---------------------------------------------------------------------
create table public.acoes_judiciais (
    id                 uuid primary key default gen_random_uuid(),
    correspondente_id  uuid not null references public.correspondentes(id),
    protocolo          text,
    cpf_cliente        text,
    cpf_agente         text,
    data_ocorrencia    date,
    data_encerramento  date,
    parecer            text,
    responsavel        text check (responsavel in ('corban', 'senff', 'indefinido')),
    mes_referencia     date not null,
    origem_export      text check (origem_export in ('normal', 'detalhada')),
    created_at         timestamptz not null default now()
);
create index on public.acoes_judiciais (correspondente_id, mes_referencia);

-- ---------------------------------------------------------------------
-- 5. AUDITORIAS EXTERNAS  (indicador obrigatório 3)
-- 6. AUDITORIAS INTERNAS  (indicador obrigatório 4)
--    Entrada manual na V1 (FR-3) — mesma estrutura para as duas.
-- ---------------------------------------------------------------------
create table public.auditorias_externas (
    id                 uuid primary key default gen_random_uuid(),
    correspondente_id  uuid not null references public.correspondentes(id),
    pilar              text not null check (pilar in (
                            'tecnologia_informacao', 'lgpd',
                            'relacionamento_cliente', 'governanca', 'treinamento')),
    pontuacao          numeric,
    subcriterios       jsonb,        -- ex.: {"controle_acesso": "ok", "rastreabilidade": "parcial"}
    data_avaliacao     date not null,
    observacoes        text,
    created_at         timestamptz not null default now()
);
create index on public.auditorias_externas (correspondente_id, data_avaliacao);

create table public.auditorias_internas (
    id                 uuid primary key default gen_random_uuid(),
    correspondente_id  uuid not null references public.correspondentes(id),
    pilar              text not null check (pilar in (
                            'tecnologia_informacao', 'lgpd',
                            'relacionamento_cliente', 'governanca', 'treinamento')),
    pontuacao          numeric,
    subcriterios       jsonb,
    data_avaliacao     date not null,
    observacoes        text,
    created_at         timestamptz not null default now()
);
create index on public.auditorias_internas (correspondente_id, data_avaliacao);

-- ---------------------------------------------------------------------
-- 7. CARTEIRA PRODUZIDA — denominador do índice (Quadro 5).
--    Fonte real ainda não confirmada; ingestão manual até resolver.
-- ---------------------------------------------------------------------
create table public.carteira_produzida (
    id                              uuid primary key default gen_random_uuid(),
    correspondente_id               uuid not null references public.correspondentes(id),
    mes_referencia                  date not null,
    operacoes_mes                   integer,
    operacoes_acumuladas_desde_2023 integer,
    fonte                           text,   -- de onde veio o número (manual, sistema X, etc.)
    created_at                      timestamptz not null default now(),
    unique (correspondente_id, mes_referencia)
);

-- ---------------------------------------------------------------------
-- 8. CLASSIFICAÇÕES MENSAIS — resultado do Quadro 5 (art. 9º)
-- ---------------------------------------------------------------------
create table public.classificacoes_mensais (
    id                          uuid primary key default gen_random_uuid(),
    correspondente_id          uuid not null references public.correspondentes(id),
    mes_referencia             date not null,
    qtd_reclamacoes_corban     integer not null default 0,
    qtd_acoes_judiciais_corban integer not null default 0,
    carteira_denominador       integer,
    indice                     numeric,
    aplicavel                  boolean not null default false,
    status                     text not null check (status in ('conforme', 'nao_conforme', 'nao_aplicavel')),
    calculado_em               timestamptz not null default now(),
    unique (correspondente_id, mes_referencia)
);

-- ---------------------------------------------------------------------
-- 9. CLASSIFICAÇÕES ANUAIS — resultado do Quadro 3 (art. 5º, Anexo I) — Fase 2
-- ---------------------------------------------------------------------
create table public.classificacoes_anuais (
    id                     uuid primary key default gen_random_uuid(),
    correspondente_id      uuid not null references public.correspondentes(id),
    ano_referencia         integer not null,
    pontuacao_geral        numeric,
    desvio_conduta_grave   boolean not null default false,
    status                 text check (status in ('conforme', 'parcialmente_conforme', 'em_atencao', 'nao_conforme')),
    calculado_em           timestamptz not null default now(),
    unique (correspondente_id, ano_referencia)
);

-- ---------------------------------------------------------------------
-- 10. MEDIDAS ADMINISTRATIVAS — lookup da escala própria de 6 níveis (Senff)
-- ---------------------------------------------------------------------
create table public.medidas_administrativas (
    id          smallint primary key,
    nivel       smallint,
    codigo      text not null unique,
    descricao   text not null
);

insert into public.medidas_administrativas (id, nivel, codigo, descricao) values
    (1, 1, 'advertencia',            'Advertência'),
    (2, 2, 'suspensao_5_dias',       'Suspensão de 5 dias úteis'),
    (3, 3, 'suspensao_10_dias',      'Suspensão de 10 dias úteis'),
    (4, 4, 'suspensao_20_dias',      'Suspensão de 20 dias úteis'),
    (5, 5, 'suspensao_30_dias',      'Suspensão de 30 dias úteis'),
    (6, 6, 'suspensao_definitiva',   'Suspensão definitiva'),
    (7, null, 'reorientacao_conduta','Reorientação de conduta (discricionária)'),
    (8, null, 'notificacao',        'Notificação (discricionária)'),
    (9, null, 'suspensao_acessos',  'Suspensão de acessos (discricionária)'),
    (10, null, 'rescisao_imediata', 'Rescisão imediata (discricionária)');

-- ---------------------------------------------------------------------
-- 11. MEDIDAS APLICADAS  (FR-11)
-- ---------------------------------------------------------------------
create table public.medidas_aplicadas (
    id                        uuid primary key default gen_random_uuid(),
    correspondente_id         uuid not null references public.correspondentes(id),
    medida_id                 smallint not null references public.medidas_administrativas(id),
    classificacao_mensal_id   uuid references public.classificacoes_mensais(id),
    classificacao_anual_id    uuid references public.classificacoes_anuais(id),
    motivo                    text,
    aplicada_por              uuid references auth.users(id),
    data_aplicacao            date not null default current_date,
    created_at                timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 12. LOG DE ALTERAÇÕES — trilha de auditoria (art. 70, retenção 5 anos)
-- ---------------------------------------------------------------------
create table public.log_alteracoes (
    id              uuid primary key default gen_random_uuid(),
    tabela_afetada  text not null,
    registro_id     uuid not null,
    operacao        text not null check (operacao in ('insert', 'update', 'delete')),
    dados_antigos   jsonb,
    dados_novos     jsonb,
    usuario_id      uuid references auth.users(id),
    criado_em       timestamptz not null default now()
);

-- =====================================================================
-- FASE 2 (referência — não bloqueia a V1): Agentes de Crédito
-- =====================================================================
-- create table public.agentes_credito (
--     id                 uuid primary key default gen_random_uuid(),
--     correspondente_id  uuid not null references public.correspondentes(id),
--     cpf                text not null,
--     nome               text,
--     created_at         timestamptz not null default now()
-- );

-- =====================================================================
-- ROW-LEVEL SECURITY
-- Regra geral: staff = acesso total; correspondente = SELECT apenas nas
-- próprias linhas. Escrita (insert/update/delete) fica só com staff na V1.
-- =====================================================================

alter table public.correspondentes      enable row level security;
alter table public.perfis               enable row level security;
alter table public.reclamacoes          enable row level security;
alter table public.acoes_judiciais      enable row level security;
alter table public.auditorias_externas  enable row level security;
alter table public.auditorias_internas  enable row level security;
alter table public.carteira_produzida   enable row level security;
alter table public.classificacoes_mensais enable row level security;
alter table public.classificacoes_anuais  enable row level security;
alter table public.medidas_administrativas enable row level security;
alter table public.medidas_aplicadas    enable row level security;
alter table public.log_alteracoes       enable row level security;

-- correspondentes
create policy "select_correspondentes" on public.correspondentes for select
    using (public.eh_staff() or id = public.meu_correspondente_id());
create policy "staff_escreve_correspondentes" on public.correspondentes for all
    using (public.eh_staff()) with check (public.eh_staff());

-- perfis (cada usuário só enxerga o próprio perfil; staff enxerga todos)
create policy "select_perfis" on public.perfis for select
    using (public.eh_staff() or id = auth.uid());
create policy "staff_escreve_perfis" on public.perfis for all
    using (public.eh_staff()) with check (public.eh_staff());

-- reclamacoes
create policy "select_reclamacoes" on public.reclamacoes for select
    using (public.eh_staff() or correspondente_id = public.meu_correspondente_id());
create policy "staff_escreve_reclamacoes" on public.reclamacoes for all
    using (public.eh_staff()) with check (public.eh_staff());

-- acoes_judiciais
create policy "select_acoes_judiciais" on public.acoes_judiciais for select
    using (public.eh_staff() or correspondente_id = public.meu_correspondente_id());
create policy "staff_escreve_acoes_judiciais" on public.acoes_judiciais for all
    using (public.eh_staff()) with check (public.eh_staff());

-- auditorias_externas
create policy "select_auditorias_externas" on public.auditorias_externas for select
    using (public.eh_staff() or correspondente_id = public.meu_correspondente_id());
create policy "staff_escreve_auditorias_externas" on public.auditorias_externas for all
    using (public.eh_staff()) with check (public.eh_staff());

-- auditorias_internas
create policy "select_auditorias_internas" on public.auditorias_internas for select
    using (public.eh_staff() or correspondente_id = public.meu_correspondente_id());
create policy "staff_escreve_auditorias_internas" on public.auditorias_internas for all
    using (public.eh_staff()) with check (public.eh_staff());

-- carteira_produzida
create policy "select_carteira_produzida" on public.carteira_produzida for select
    using (public.eh_staff() or correspondente_id = public.meu_correspondente_id());
create policy "staff_escreve_carteira_produzida" on public.carteira_produzida for all
    using (public.eh_staff()) with check (public.eh_staff());

-- classificacoes_mensais
create policy "select_classificacoes_mensais" on public.classificacoes_mensais for select
    using (public.eh_staff() or correspondente_id = public.meu_correspondente_id());
create policy "staff_escreve_classificacoes_mensais" on public.classificacoes_mensais for all
    using (public.eh_staff()) with check (public.eh_staff());

-- classificacoes_anuais
create policy "select_classificacoes_anuais" on public.classificacoes_anuais for select
    using (public.eh_staff() or correspondente_id = public.meu_correspondente_id());
create policy "staff_escreve_classificacoes_anuais" on public.classificacoes_anuais for all
    using (public.eh_staff()) with check (public.eh_staff());

-- medidas_administrativas (lookup): leitura liberada a qualquer autenticado
create policy "select_medidas_administrativas" on public.medidas_administrativas for select
    using (auth.role() = 'authenticated');
create policy "staff_escreve_medidas_administrativas" on public.medidas_administrativas for all
    using (public.eh_staff()) with check (public.eh_staff());

-- medidas_aplicadas
create policy "select_medidas_aplicadas" on public.medidas_aplicadas for select
    using (public.eh_staff() or correspondente_id = public.meu_correspondente_id());
create policy "staff_escreve_medidas_aplicadas" on public.medidas_aplicadas for all
    using (public.eh_staff()) with check (public.eh_staff());

-- log_alteracoes: só staff, nunca correspondente
create policy "staff_le_log_alteracoes" on public.log_alteracoes for select
    using (public.eh_staff());
create policy "staff_escreve_log_alteracoes" on public.log_alteracoes for insert
    with check (public.eh_staff());

-- =====================================================================
-- Fim do schema V1.
-- Lembrete: o script de ETL deve rodar com a service_role key (bypassa RLS
-- por padrão) — nunca exponha essa chave no dashboard Streamlit, que deve
-- usar a anon key + login de usuário para respeitar as policies acima.
--
-- Pós-instalação: criar usuários em Authentication > Users e inserir o
-- perfil, por exemplo:
--   insert into public.perfis (id, role) values ('<uuid-do-usuario>', 'staff');
--   insert into public.perfis (id, role, correspondente_id)
--       values ('<uuid>', 'correspondente', '<uuid-do-correspondente>');
-- =====================================================================
