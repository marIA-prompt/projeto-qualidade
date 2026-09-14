-- =============================================================================
-- Plano de Qualidade de Correspondentes — Schema + RLS (V1 / MVP)
-- =============================================================================
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto novo, plano
-- gratuito) ANTES de rodar o ETL ou o dashboard.
--
-- Convenções:
--   * service_role key  -> usada SOMENTE pelo ETL (etl/etl_reclamacoes.py),
--     fora do contexto de um usuário logado. Ignora RLS por design.
--   * anon key          -> usada pelo dashboard Streamlit, sempre com um
--     usuário autenticado via Supabase Auth. Respeita RLS.
--   * Papéis de aplicação (tabela `perfis`, não confundir com roles do
--     Postgres): 'staff' (Qualidade/Compliance, acesso total) e
--     'correspondente' (acesso restrito ao próprio correspondente_id).
--
-- Referências normativas citadas nos comentários: Normativo Correlato da
-- Autorregulação do Crédito Consignado (arts. 50-55, 69-70, 110) e seu
-- Anexo I (arts. 5º/Quadro 3 e 9º/Quadro 5). Ver docs/plano_qualidade_correspondentes.md.
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- 1. CORRESPONDENTES
-- =============================================================================
create table if not exists public.correspondentes (
    id          uuid primary key default gen_random_uuid(),
    cnpj        text not null unique,
    nome        text,
    ativo       boolean not null default true,
    criado_em   timestamptz not null default now()
);

comment on table public.correspondentes is
    'Cadastro de correspondentes bancários monitorados pelo Plano de Qualidade. Chave de isolamento do RLS.';

-- =============================================================================
-- 2. PERFIS (mapeamento auth.users -> papel de aplicação)
-- =============================================================================
create table if not exists public.perfis (
    id                  uuid primary key references auth.users (id) on delete cascade,
    papel               text not null check (papel in ('staff', 'correspondente')),
    correspondente_id   uuid references public.correspondentes (id),
    criado_em           timestamptz not null default now(),
    constraint perfis_correspondente_obrigatorio check (
        (papel = 'correspondente' and correspondente_id is not null)
        or (papel = 'staff')
    )
);

comment on table public.perfis is
    'Mapeia um usuário do Supabase Auth a um papel de aplicação (staff ou correspondente) e, quando aplicável, ao correspondente vinculado.';

-- Funções auxiliares para as políticas de RLS. SECURITY DEFINER evita
-- recursão de RLS ao consultar a própria tabela `perfis`.
create or replace function public.papel_atual()
returns text
language sql
security definer
set search_path = public
stable
as $$
    select papel from public.perfis where id = auth.uid();
$$;

create or replace function public.correspondente_atual()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
    select correspondente_id from public.perfis where id = auth.uid();
$$;

create or replace function public.eh_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select coalesce(public.papel_atual() = 'staff', false);
$$;

-- =============================================================================
-- 3. RECLAMAÇÕES e AÇÕES JUDICIAIS
-- =============================================================================
-- Estrutura idêntica para as duas tabelas: uma linha por ocorrência da
-- exportação DETALHADA do navigate (Tipo de Ocorrência = 4 -> reclamacoes;
-- = 1 -> acoes_judiciais), enriquecida com a atribuição de responsabilidade
-- (Corban/Senff/indefinido) obtida via cruzamento com a exportação NORMAL.
-- Ver etl/README.md e docs/decisoes.md (D2) para o racional de "indefinido".

create table if not exists public.reclamacoes (
    id                      uuid primary key default gen_random_uuid(),
    correspondente_id       uuid not null references public.correspondentes (id),
    mes_referencia          text not null check (mes_referencia ~ '^\d{4}-\d{2}$'),
    identificador_ocorrencia text not null unique,
    protocolo_normal        text,
    numero_contrato         text,
    cpf_agente              text,
    cpf_cliente             text,
    canal_origem            text,
    tipo_reclamacao         text,
    data_ocorrencia         date,
    data_encerramento       date,
    data_cadastro_normal    date,
    parecer_detalhado       text check (parecer_detalhado in ('procedente', 'improcedente')),
    responsavel             text not null check (responsavel in ('corban', 'senff', 'indefinido')),
    procedente_corban       boolean not null default false,
    encaminhado_fraudes     boolean not null default false,
    criado_em               timestamptz not null default now()
);

comment on table public.reclamacoes is
    'Reclamações (Tipo de Ocorrência = 4 na exportação detalhada do navigate), art. 51-53 do Normativo Correlato.';

create table if not exists public.acoes_judiciais (
    id                      uuid primary key default gen_random_uuid(),
    correspondente_id       uuid not null references public.correspondentes (id),
    mes_referencia          text not null check (mes_referencia ~ '^\d{4}-\d{2}$'),
    identificador_ocorrencia text not null unique,
    protocolo_normal        text,
    numero_contrato         text,
    cpf_agente              text,
    cpf_cliente             text,
    tipo_reclamacao         text,
    data_ocorrencia         date,
    data_encerramento       date,
    data_cadastro_normal    date,
    parecer_detalhado       text check (parecer_detalhado in ('procedente', 'improcedente')),
    responsavel             text not null check (responsavel in ('corban', 'senff', 'indefinido')),
    procedente_corban       boolean not null default false,
    encaminhado_fraudes     boolean not null default false,
    criado_em               timestamptz not null default now()
);

comment on table public.acoes_judiciais is
    'Ações judiciais (Tipo de Ocorrência = 1 na exportação detalhada do navigate), art. 51-53 do Normativo Correlato.';

create index if not exists idx_reclamacoes_correspondente_mes on public.reclamacoes (correspondente_id, mes_referencia);
create index if not exists idx_acoes_judiciais_correspondente_mes on public.acoes_judiciais (correspondente_id, mes_referencia);

-- =============================================================================
-- 4. AUDITORIAS EXTERNAS / INTERNAS (entrada manual na V1 — FR-3, Fase 2)
-- =============================================================================
-- Criadas agora (schema completo pedido pelo briefing), mas a V1 não grava
-- nem lê estas tabelas a partir do ETL; a ingestão continua manual/planilha
-- até o módulo de auditorias (Fase 2) ser implementado.
create table if not exists public.auditorias_externas (
    id                  uuid primary key default gen_random_uuid(),
    correspondente_id   uuid not null references public.correspondentes (id),
    ano_referencia      int not null,
    pilar               text not null check (pilar in (
        'tecnologia_informacao', 'lgpd', 'relacionamento_cliente', 'governanca', 'treinamento'
    )),
    pontuacao           numeric,
    observacoes         text,
    data_avaliacao      date,
    criado_em           timestamptz not null default now()
);

create table if not exists public.auditorias_internas (
    id                  uuid primary key default gen_random_uuid(),
    correspondente_id   uuid not null references public.correspondentes (id),
    ano_referencia      int not null,
    pilar               text not null check (pilar in (
        'tecnologia_informacao', 'lgpd', 'relacionamento_cliente', 'governanca', 'treinamento'
    )),
    pontuacao           numeric,
    observacoes         text,
    data_avaliacao      date,
    criado_em           timestamptz not null default now()
);

-- =============================================================================
-- 5. CARTEIRA PRODUZIDA (denominador do índice — art. 9º / Quadro 5)
-- =============================================================================
-- Bloqueio conhecido (docs/decisoes.md, D1): nenhum export do navigate traz
-- este dado. Ingestão manual (planilha) até a fonte real ser confirmada.
create table if not exists public.carteira_produzida (
    id                  uuid primary key default gen_random_uuid(),
    correspondente_id   uuid not null references public.correspondentes (id),
    mes_referencia      text not null check (mes_referencia ~ '^\d{4}-\d{2}$'),
    total_operacoes     integer not null check (total_operacoes >= 0),
    origem              text not null default 'manual',
    observacoes         text,
    criado_em           timestamptz not null default now(),
    unique (correspondente_id, mes_referencia)
);

comment on table public.carteira_produzida is
    'Volume de operações produzidas pelo correspondente desde jan/2023, por mês de referência. Denominador do índice do Quadro 5. Ingestão manual na V1 (docs/decisoes.md D1).';

-- =============================================================================
-- 6. CLASSIFICAÇÕES (resultado do motor_classificacao)
-- =============================================================================
create table if not exists public.classificacoes_mensais (
    id                              uuid primary key default gen_random_uuid(),
    correspondente_id               uuid not null references public.correspondentes (id),
    mes_referencia                  text not null check (mes_referencia ~ '^\d{4}-\d{2}$'),
    qtd_reclamacoes_procedentes_corban integer not null default 0,
    qtd_acoes_procedentes_corban       integer not null default 0,
    qtd_reclamacoes_mes                integer not null default 0,
    numerador                       integer not null default 0,
    denominador_carteira            integer,
    total_operacoes                 integer,
    indice                          numeric,
    aplicavel                       boolean not null default false,
    status                          text not null check (status in ('conforme', 'nao_conforme', 'nao_aplicavel')),
    calculado_em                    timestamptz not null default now(),
    unique (correspondente_id, mes_referencia)
);

comment on table public.classificacoes_mensais is
    'Resultado gravado do motor de classificação (Quadro 5, art. 9º do Anexo I) por correspondente/mês.';

-- Reservada para a Fase 2 (Quadro 3, art. 5º do Anexo I). Criada agora para
-- evitar migração destrutiva depois; a V1 não escreve nesta tabela.
create table if not exists public.classificacoes_anuais (
    id                      uuid primary key default gen_random_uuid(),
    correspondente_id       uuid not null references public.correspondentes (id),
    ano_referencia          int not null,
    pontuacao_geral         numeric,
    desvio_conduta_grave    boolean not null default false,
    status                  text check (status in ('conforme', 'parcialmente_conforme', 'em_atencao', 'nao_conforme')),
    calculado_em            timestamptz not null default now(),
    unique (correspondente_id, ano_referencia)
);

-- =============================================================================
-- 7. MEDIDAS ADMINISTRATIVAS (lookup, art. 110) e MEDIDAS APLICADAS (FR-11)
-- =============================================================================
create table if not exists public.medidas_administrativas (
    id          smallint primary key,
    nivel       smallint not null unique,
    codigo      text not null unique,
    descricao   text not null
);

comment on table public.medidas_administrativas is
    'Escala fixa de 6 níveis do art. 110 do Normativo Correlato, aplicável quando o monitoramento mensal (Quadro 5) resulta em não conforme.';

insert into public.medidas_administrativas (id, nivel, codigo, descricao) values
    (1, 1, 'advertencia', 'Advertência'),
    (2, 2, 'suspensao_5_dias', 'Suspensão de contratação de novas operações por 5 dias úteis'),
    (3, 3, 'suspensao_10_dias', 'Suspensão de contratação de novas operações por 10 dias úteis'),
    (4, 4, 'suspensao_20_dias', 'Suspensão de contratação de novas operações por 20 dias úteis'),
    (5, 5, 'suspensao_30_dias', 'Suspensão de contratação de novas operações por 30 dias úteis'),
    (6, 6, 'suspensao_definitiva', 'Suspensão definitiva de contratação de novas operações')
on conflict (id) do nothing;

create table if not exists public.medidas_aplicadas (
    id                      uuid primary key default gen_random_uuid(),
    correspondente_id       uuid not null references public.correspondentes (id),
    classificacao_mensal_id uuid references public.classificacoes_mensais (id),
    medida_id               smallint not null references public.medidas_administrativas (id),
    motivo                  text,
    aplicada_por            uuid references auth.users (id),
    aplicada_em             date not null default current_date,
    observacoes             text,
    criado_em               timestamptz not null default now()
);

comment on table public.medidas_aplicadas is
    'Registro manual (FR-11) de qual medida administrativa da escala de 6 níveis foi efetivamente aplicada a um correspondente. Gravação é sempre um ato humano (Gestora de Qualidade) — o sistema não decide sozinho.';

-- =============================================================================
-- 8. AGENTES DE CRÉDITO (reservada para Fase 2 — Quadro 6, não usada pela V1)
-- =============================================================================
create table if not exists public.agentes_credito (
    id                  uuid primary key default gen_random_uuid(),
    correspondente_id   uuid not null references public.correspondentes (id),
    cpf                 text not null,
    nome                text,
    criado_em           timestamptz not null default now(),
    unique (correspondente_id, cpf)
);

-- =============================================================================
-- 9. LOG DE ALTERAÇÕES (trilha de auditoria — art. 70, retenção mínima 5 anos)
-- =============================================================================
create table if not exists public.log_alteracoes (
    id              bigint generated always as identity primary key,
    tabela          text not null,
    registro_id     uuid,
    operacao        text not null check (operacao in ('INSERT', 'UPDATE', 'DELETE')),
    dados_antigos   jsonb,
    dados_novos     jsonb,
    usuario         uuid references auth.users (id),
    criado_em       timestamptz not null default now()
);

comment on table public.log_alteracoes is
    'Trilha de auditoria de alterações nas tabelas sensíveis. Retenção mínima de 5 anos para casos vinculados a fraude/golpe (art. 70, parágrafo único). Nunca apagar linhas desta tabela via aplicação.';

create or replace function public.registrar_log_alteracao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.log_alteracoes (tabela, registro_id, operacao, dados_antigos, dados_novos, usuario)
    values (
        tg_table_name,
        coalesce((case when tg_op = 'DELETE' then old.id else new.id end), null),
        tg_op,
        case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
        case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else null end,
        auth.uid()
    );
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_log_reclamacoes on public.reclamacoes;
create trigger trg_log_reclamacoes
    after insert or update or delete on public.reclamacoes
    for each row execute function public.registrar_log_alteracao();

drop trigger if exists trg_log_acoes_judiciais on public.acoes_judiciais;
create trigger trg_log_acoes_judiciais
    after insert or update or delete on public.acoes_judiciais
    for each row execute function public.registrar_log_alteracao();

drop trigger if exists trg_log_medidas_aplicadas on public.medidas_aplicadas;
create trigger trg_log_medidas_aplicadas
    after insert or update or delete on public.medidas_aplicadas
    for each row execute function public.registrar_log_alteracao();

-- =============================================================================
-- 10. ROW LEVEL SECURITY
-- =============================================================================
alter table public.correspondentes        enable row level security;
alter table public.perfis                 enable row level security;
alter table public.reclamacoes            enable row level security;
alter table public.acoes_judiciais        enable row level security;
alter table public.auditorias_externas    enable row level security;
alter table public.auditorias_internas    enable row level security;
alter table public.carteira_produzida     enable row level security;
alter table public.classificacoes_mensais enable row level security;
alter table public.classificacoes_anuais  enable row level security;
alter table public.medidas_administrativas enable row level security;
alter table public.medidas_aplicadas      enable row level security;
alter table public.agentes_credito        enable row level security;
alter table public.log_alteracoes         enable row level security;

-- perfis: cada usuário vê o próprio perfil; staff vê todos.
create policy perfis_select_proprio on public.perfis
    for select using (id = auth.uid() or public.eh_staff());
create policy perfis_staff_gerencia on public.perfis
    for all using (public.eh_staff()) with check (public.eh_staff());

-- correspondentes: staff vê/edita tudo; correspondente vê só o próprio registro.
create policy correspondentes_staff_all on public.correspondentes
    for all using (public.eh_staff()) with check (public.eh_staff());
create policy correspondentes_proprio on public.correspondentes
    for select using (id = public.correspondente_atual());

-- reclamacoes / acoes_judiciais: leitura restrita ao próprio correspondente;
-- escrita apenas por staff (o ETL usa service_role e ignora RLS de qualquer forma).
create policy reclamacoes_staff_all on public.reclamacoes
    for all using (public.eh_staff()) with check (public.eh_staff());
create policy reclamacoes_proprio_select on public.reclamacoes
    for select using (correspondente_id = public.correspondente_atual());

create policy acoes_judiciais_staff_all on public.acoes_judiciais
    for all using (public.eh_staff()) with check (public.eh_staff());
create policy acoes_judiciais_proprio_select on public.acoes_judiciais
    for select using (correspondente_id = public.correspondente_atual());

-- auditorias externas/internas: mesmo padrão (staff all, correspondente lê o próprio).
create policy auditorias_externas_staff_all on public.auditorias_externas
    for all using (public.eh_staff()) with check (public.eh_staff());
create policy auditorias_externas_proprio_select on public.auditorias_externas
    for select using (correspondente_id = public.correspondente_atual());

create policy auditorias_internas_staff_all on public.auditorias_internas
    for all using (public.eh_staff()) with check (public.eh_staff());
create policy auditorias_internas_proprio_select on public.auditorias_internas
    for select using (correspondente_id = public.correspondente_atual());

-- carteira_produzida: staff gerencia; correspondente só lê a própria.
create policy carteira_produzida_staff_all on public.carteira_produzida
    for all using (public.eh_staff()) with check (public.eh_staff());
create policy carteira_produzida_proprio_select on public.carteira_produzida
    for select using (correspondente_id = public.correspondente_atual());

-- classificacoes_mensais / anuais: staff gerencia; correspondente só lê a própria.
create policy classificacoes_mensais_staff_all on public.classificacoes_mensais
    for all using (public.eh_staff()) with check (public.eh_staff());
create policy classificacoes_mensais_proprio_select on public.classificacoes_mensais
    for select using (correspondente_id = public.correspondente_atual());

create policy classificacoes_anuais_staff_all on public.classificacoes_anuais
    for all using (public.eh_staff()) with check (public.eh_staff());
create policy classificacoes_anuais_proprio_select on public.classificacoes_anuais
    for select using (correspondente_id = public.correspondente_atual());

-- medidas_administrativas: lookup público para qualquer usuário autenticado.
create policy medidas_administrativas_leitura on public.medidas_administrativas
    for select using (auth.role() = 'authenticated');

-- medidas_aplicadas: staff gerencia (grava a decisão humana); correspondente só lê a própria.
create policy medidas_aplicadas_staff_all on public.medidas_aplicadas
    for all using (public.eh_staff()) with check (public.eh_staff());
create policy medidas_aplicadas_proprio_select on public.medidas_aplicadas
    for select using (correspondente_id = public.correspondente_atual());

-- agentes_credito (reservada para Fase 2): mesmo padrão de isolamento.
create policy agentes_credito_staff_all on public.agentes_credito
    for all using (public.eh_staff()) with check (public.eh_staff());
create policy agentes_credito_proprio_select on public.agentes_credito
    for select using (correspondente_id = public.correspondente_atual());

-- log_alteracoes: somente staff lê; ninguém apaga via API (retenção 5 anos, art. 70).
create policy log_alteracoes_staff_select on public.log_alteracoes
    for select using (public.eh_staff());
