-- Migration: 02_rls.sql
-- El servicio Node accede con service_role key, por lo que RLS no es estrictamente
-- necesaria; sin embargo, mantener RLS habilitada con politicas restrictivas es una
-- red de seguridad ante un eventual mal uso de la anon key o filtracion de service_role.

alter table public.api_clients     enable row level security;
alter table public.ai_summaries    enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages     enable row level security;

-- Sin politicas explicitas -> nadie puede leer/escribir mediante PostgREST con anon/auth.
-- Solo la service_role (que ignora RLS) puede operar sobre estas tablas.
-- Si en el futuro se decide exponer alguna lectura a JWT, agregar policies aqui.

revoke all on public.api_clients      from anon, authenticated;
revoke all on public.ai_summaries     from anon, authenticated;
revoke all on public.ai_conversations from anon, authenticated;
revoke all on public.ai_messages      from anon, authenticated;
