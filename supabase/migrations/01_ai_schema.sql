-- Migration: 01_ai_schema.sql
-- Tablas principales para el EMR AI Service.
-- Este schema vive en un proyecto Supabase INDEPENDIENTE del Supabase del EMR principal.
-- RLS no se habilita: el servicio Node usa la service_role key y aplica autorizacion
-- en su middleware (api_clients + JWT del Supabase del cliente EMR).

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1) Clientes (tenants) que tienen permitido consumir el AI service.
-- ============================================================================
create table if not exists public.api_clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  api_key_hash  text not null unique,
  jwks_url      text not null,
  audience      text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.api_clients is
  'Tenants autorizados a consumir el AI service. api_key_hash usa argon2id; jwks_url apunta al Supabase del EMR cliente para verificar JWTs.';

-- ============================================================================
-- 2) Resumenes generados (cache determinista).
-- ============================================================================
create table if not exists public.ai_summaries (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.api_clients(id) on delete cascade,
  kind            text not null check (kind in ('medical_record', 'evolution')),
  entity_id       text not null,
  payload_hash    text not null,
  prompt_version  text not null,
  provider        text not null check (provider in ('deepseek', 'openrouter', 'mock')),
  model           text not null,
  content         text not null,
  tokens_input    integer,
  tokens_output   integer,
  created_by      uuid not null,
  created_at      timestamptz not null default now()
);

create unique index if not exists ai_summaries_cache_key
  on public.ai_summaries (client_id, kind, entity_id, payload_hash);

create index if not exists ai_summaries_lookup
  on public.ai_summaries (client_id, kind, entity_id, created_at desc);

comment on table public.ai_summaries is
  'Cache de resumenes clinicos. La clave logica (client_id, kind, entity_id, payload_hash) garantiza idempotencia: si nada cambio en el payload o el prompt_version, se reutiliza la respuesta del LLM.';

-- ============================================================================
-- 3) Conversaciones de seguimiento (chats post-resumen).
-- ============================================================================
create table if not exists public.ai_conversations (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.api_clients(id) on delete cascade,
  summary_id         uuid references public.ai_summaries(id) on delete set null,
  kind               text not null check (kind in ('medical_record', 'evolution')),
  entity_id          text not null,
  user_id            uuid not null,
  title              text,
  model_preference   text not null default 'auto' check (model_preference in ('deepseek', 'auto')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists ai_conversations_by_user
  on public.ai_conversations (client_id, user_id, updated_at desc);

create index if not exists ai_conversations_by_entity
  on public.ai_conversations (client_id, kind, entity_id);

-- ============================================================================
-- 4) Mensajes de las conversaciones (user/assistant/system).
-- ============================================================================
create table if not exists public.ai_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.ai_conversations(id) on delete cascade,
  role             text not null check (role in ('system', 'user', 'assistant')),
  content          text not null,
  provider         text,
  model            text,
  tokens_input     integer,
  tokens_output    integer,
  created_at       timestamptz not null default now()
);

create index if not exists ai_messages_by_conversation
  on public.ai_messages (conversation_id, created_at);

-- ============================================================================
-- Trigger generico para mantener updated_at en sync.
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_api_clients_touch on public.api_clients;
create trigger trg_api_clients_touch
  before update on public.api_clients
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_ai_conversations_touch on public.ai_conversations;
create trigger trg_ai_conversations_touch
  before update on public.ai_conversations
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Trigger: cuando llega un mensaje nuevo, bump del updated_at de la conversacion.
-- ============================================================================
create or replace function public.bump_conversation_on_message()
returns trigger
language plpgsql
as $$
begin
  update public.ai_conversations
     set updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_conversation on public.ai_messages;
create trigger trg_bump_conversation
  after insert on public.ai_messages
  for each row execute function public.bump_conversation_on_message();
