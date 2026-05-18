-- Migration: 02_rls.sql
-- El servicio Node accede con la secret key de Supabase (sb_secret_xxx o, en
-- proyectos antiguos, la legacy service_role JWT). Ambas bypasan RLS, por lo
-- que RLS no es estrictamente necesaria; sin embargo, mantenerla habilitada
-- con politicas restrictivas es una red de seguridad ante un eventual mal uso
-- de las publishable/anon keys o una filtracion accidental de la secret key.

alter table public.api_clients     enable row level security;
alter table public.ai_summaries    enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages     enable row level security;

-- Sin politicas explicitas -> nadie puede leer/escribir mediante PostgREST con
-- las publishable/anon/authenticated keys. Solo la secret key (que ignora RLS)
-- puede operar sobre estas tablas. Si en el futuro se decide exponer alguna
-- lectura a JWT autenticado, agregar policies aqui.

revoke all on public.api_clients      from anon, authenticated;
revoke all on public.ai_summaries     from anon, authenticated;
revoke all on public.ai_conversations from anon, authenticated;
revoke all on public.ai_messages      from anon, authenticated;
