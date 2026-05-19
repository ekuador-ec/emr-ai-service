-- Migration: 04_general_conversations.sql
-- Permite conversaciones de tipo 'general': dudas medicas libres del usuario
-- sin atadura a una HC o EM especifica. Para esas, entity_id queda NULL.
-- Las conversaciones de tipo 'medical_record' y 'evolution' siguen requiriendo
-- entity_id; esa regla se valida a nivel de caso de uso (no en el schema)
-- porque el constraint check no puede mirar otra columna en algunas configuraciones
-- antiguas de Postgres; el use case StartConversation impone la regla.

alter table public.ai_conversations
  drop constraint if exists ai_conversations_kind_check;

alter table public.ai_conversations
  add constraint ai_conversations_kind_check
  check (kind in ('medical_record', 'evolution', 'general'));

alter table public.ai_conversations
  alter column entity_id drop not null;

comment on column public.ai_conversations.entity_id is
  'UUID de la HC o EM asociada. Es NULL para conversaciones de tipo "general" (consultas medicas libres no atadas a una entidad clinica).';
