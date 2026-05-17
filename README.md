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
pnpm dev         # tsx watch
pnpm build       # tsc -p tsconfig.build.json
pnpm start       # node dist/...
pnpm lint        # oxlint .
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
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
