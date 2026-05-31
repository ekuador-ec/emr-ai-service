# EMR AI Service

Servicio API independiente que provee resumenes clinicos y chats de seguimiento sobre Historias Clinicas (HC) y Evoluciones Medicas (EM) para el ecosistema EMR. Disenado para ser consumido por una o varias instancias del frontend `emr-system-web` (multi-tenant) mediante autenticacion en dos capas (API key por tenant + JWT de Supabase del usuario final).

## Caracteristicas

- Resumenes clinicos cacheados (HC + EMs asociadas).
- Resumenes individuales de EM.
- Chat de seguimiento con streaming SSE.
- Doble anonimizacion (cliente + servidor) - nunca se envia PII al LLM.
- Multi-proveedor: DeepSeek directo y OpenRouter (modo `auto` con rotacion de modelos).
- Cache determinista por hash del payload + version del prompt.
- Multi-tenant: una sola instancia sirve a multiples deployments del EMR.

## Stack

- Node.js 20+
- Express + TypeScript
- Supabase (Postgres) para persistencia
- SDK `openai` (compatible con DeepSeek y OpenRouter)
- Zod para validacion
- Vitest para pruebas

## Setup

```bash
pnpm install
cp .env.example .env
# completa las variables
pnpm dev
```

## Scripts

```bash
pnpm dev               # tsx watch
pnpm build             # tsc -p tsconfig.build.json
pnpm start             # node dist/...
pnpm lint              # oxlint .
pnpm typecheck         # tsc --noEmit
pnpm test              # vitest run

# Operacion / diagnostico
pnpm smoke             # smoke test end-to-end: Supabase + OpenRouter (+ DeepSeek opcional)
pnpm openrouter:list   # lista los modelos :free disponibles en OpenRouter ahora mismo
pnpm openrouter:probe  # prueba cada modelo del pool sugerido y reporta cuales responden
pnpm client:create     # crea un api_client (tenant) en la DB y devuelve el API key plano UNA vez
```

## Arquitectura

Clean Architecture con 4 capas (mismas reglas que `emr-system-web`):

```
src/
  domain/          Modelos, interfaces de repositorios y servicios (sin libs externas)
  application/     Casos de uso y servicios de orquestacion
  infrastructure/  Implementaciones reales (Supabase, OpenAI SDK, JWT)
  presentation/    HTTP (Express), controllers, middleware, schemas Zod
```

Consultar `AGENTS.md` para reglas detalladas.

## Despliegue en Railway

El servicio es un proceso Express de larga vida (no serverless). Railway lo corre
directamente desde el `Dockerfile`.

### Pasos

1. En Railway: **New Project -> Deploy from GitHub repo** y selecciona este repositorio.
2. Railway detecta `railway.json` y construye con el `Dockerfile` (builder `DOCKERFILE`).
3. Configura las variables de entorno (ver checklist abajo) en **Variables**.
4. El deploy queda "live" solo cuando `GET /health` responde `200` (healthcheck configurado en `railway.json`).

### Puerto

No fijes `PORT` manualmente: Railway inyecta su propio `PORT` y la app ya lo lee desde
`process.env.PORT` (con default 8080 en local). Express escucha en `0.0.0.0` por defecto,
asi que el enrutamiento de Railway funciona sin cambios.

### Checklist de variables de entorno

Requeridas:

- `NODE_ENV=production`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (o `SUPABASE_SERVICE_ROLE_KEY` como fallback legacy)
- `OPENROUTER_API_KEY` y/o `DEEPSEEK_API_KEY` (al menos un proveedor real; sin ninguno cae al mock)
- `CORS_ALLOWED_ORIGINS` con el origen de produccion del frontend (no usar `*`)

Opcionales (tienen default, ajustar si aplica): `LOG_LEVEL`, `DEEPSEEK_BASE_URL`,
`DEEPSEEK_MODEL`, `OPENROUTER_BASE_URL`, `OPENROUTER_SITE_URL`, `OPENROUTER_SITE_NAME`,
`OPENROUTER_AUTO_MODELS`, `PROMPT_VERSION_*`, `RATE_LIMIT_PER_MINUTE`,
`MAX_CHAT_HISTORY_MESSAGES`. Referencia completa en `.env.example`.

### Verificacion post-deploy

```bash
curl https://<tu-servicio>.up.railway.app/health
# -> { "status": "ok", "timestamp": "...", "uptimeSeconds": N, "version": "...", "environment": "production" }
```

Las rutas `/v1/**` requieren los headers `X-Api-Key` y `Authorization: Bearer <jwt>`.
