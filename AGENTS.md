# Reglas y Contexto del Proyecto para Agentes de IA

> **IMPORTANTE PARA EL AGENTE:** Al leer este archivo (`AGENTS.md`), asumes el rol de desarrollador en este ecosistema. DEBES cumplir estrictamente TODAS las convenciones y reglas aqui estipuladas en cada interaccion.

Este es el **EMR AI Service**: API independiente en Node.js que provee resumenes clinicos y chats de seguimiento basados en LLMs (DeepSeek + OpenRouter). Se consume desde el frontend `emr-system-web` (y eventualmente otras instalaciones EMR) via REST con autenticacion service-to-service + JWT.

## Stack

- **Runtime:** Node.js 22+ (requerido por `@supabase/supabase-js`, que necesita WebSocket nativo; en Node <22 el cliente crashea al instanciarse)
- **Lenguaje:** TypeScript (ESM, NodeNext)
- **HTTP:** Express 4
- **Validacion:** Zod
- **DB:** Supabase (Postgres) - proyecto independiente del EMR principal
- **LLMs:** DeepSeek (directo) + OpenRouter (multi-modelo, modo auto)
- **SDK:** `openai` (compatible con ambos providers)
- **Tests:** Vitest + Supertest
- **Linter:** Oxlint
- **Gestor de paquetes:** pnpm

## Reglas Arquitectonicas: Clean Architecture

Cuatro capas con dependencia unidireccional (`presentation -> application -> domain`, `infrastructure -> domain`).

1. **Domain (`src/domain`)**
   - Modelos, enums, interfaces de repositorios y servicios.
   - Cero dependencias externas. Prohibido importar express, supabase, zod, openai.

2. **Application (`src/application`)**
   - Casos de uso (clases con `execute`).
   - Servicios de orquestacion (PromptBuilder, PayloadHasher, Sanitizer policy).
   - Solo depende del dominio. Prohibido el acceso a red o sistema de archivos.

3. **Infrastructure (`src/infrastructure`)**
   - Implementaciones concretas: SupabaseXxxRepository, DeepseekProvider, OpenRouterProvider, JWT validator.
   - Unica capa que conoce HTTP externo y SQL.

4. **Presentation (`src/presentation`)**
   - HTTP layer: server.ts, routes, controllers, middleware, schemas Zod, SSE writer.
   - REGLA (Validaciones): los schemas Zod viven en `src/presentation/http/schemas/<feature>.schema.ts`. Prohibido definirlos dentro de controllers.

## Reglas de TypeScript y Estilo

- **`verbatimModuleSyntax`**: importar tipos con `import type`.
- **`erasableSyntaxOnly`**: prohibido usar "propiedades de parametros" (`constructor(private repo: Repo) {}`). Declarar campos explicitamente y asignar en el cuerpo del constructor.
- **`noUncheckedIndexedAccess`** habilitado: validar acceso a indices.
- **Tipado estricto**: prohibido `any`. Usar `unknown` cuando sea necesario y reducir con type guards.
- **Imports**: usar siempre rutas relativas con extension `.js` (NodeNext ESM). NO usar alias `@/` para evitar configuracion extra; este repo es lo suficientemente pequeno.
- **Cero emojis** en codigo, comentarios, mensajes de commit o documentacion.
- **Comentarios**: solo cuando explican el *por que* de una decision tecnica inusual. El codigo debe ser autodescriptivo.

## Reglas de Seguridad

- **Nunca enviar PII al LLM**: el `ServerSanitizer` (capa infraestructura) recorre cada payload y aplica blacklist de keys + regex de cedula EC, email, telefono. Si encuentra match, lo reemplaza por `[REDACTED]` y lanza warning.
- **Autenticacion en dos capas obligatoria**: todo endpoint protegido valida `X-Api-Key` (api_clients) **y** `Authorization: Bearer <jwt>` (JWKS del Supabase del cliente).
- **Supabase secret key**: solo se usa server-side. Jamas se devuelve al cliente. Preferir la API key moderna `SUPABASE_SECRET_KEY` (formato `sb_secret_xxx`); si el proyecto Supabase aun no migra a las nuevas claves, `SUPABASE_SERVICE_ROLE_KEY` se acepta como fallback legacy. Ambas bypasan RLS, asi que el manejo es identico.
- **Logs**: nunca loguear el body completo de requests con PII. Loguear `clientId`, `userId`, `kind`, `entityId` y hashes.

## Reglas de Persistencia

- **Supabase del AI service es independiente** del Supabase del EMR principal.
- Acceso unicamente desde la capa infraestructura via `supabaseClient.ts`.
- Los repositorios devuelven modelos del dominio; los mappers traducen snake_case a camelCase.
- Cache de resumenes: clave compuesta `(client_id, kind, entity_id, payload_hash)`.
- `payload_hash = sha256(canonicalize(payload) + "|" + prompt_version)`.

## Reglas de LLM

- **Proveedores intercambiables**: `LlmProvider` interfaz comun con metodos `chat(messages, opts)` y `chatStream(messages, opts)`.
- **`LlmRouter`** decide el provider segun `preference` (`deepseek` o `auto`).
- En `auto`, el router selecciona un modelo de `OPENROUTER_AUTO_MODELS` aleatoriamente. Si falla con 5xx, hace fallback al siguiente.
- **Prompts versionados**: cualquier cambio al prompt requiere bump de version (`medical-record-v1` -> `medical-record-v2`). Esto invalida cache automaticamente.
- **Streaming**: respuestas de chat se transmiten via SSE token a token. Persistencia del mensaje completo ocurre al finalizar el stream.

## Convenciones de Codigo

- Una clase por archivo en domain/application; nombres descriptivos.
- Use cases exponen `execute(input): Promise<output>`.
- Errores de dominio extienden `DomainError` (en `src/shared/errors.ts`). La capa HTTP los traduce a status apropiados.
- Tests viven junto al archivo (`Foo.test.ts` al lado de `Foo.ts`) o en `tests/` para tests de integracion.

## Scripts

```bash
pnpm dev        # tsx watch
pnpm build      # tsc -p tsconfig.build.json
pnpm start      # node dist/presentation/http/server.js
pnpm lint       # oxlint .
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest run
```

Antes de marcar una tarea como completada: ejecutar `pnpm lint` y `pnpm typecheck` como minimo, y `pnpm test` si se tocaron use cases o servicios de aplicacion/dominio.

## Variables de Entorno

Documentadas en `.env.example`. Validadas con Zod al boot del servidor en `src/config/env.ts`. Si una env requerida falta, el proceso debe abortar con mensaje claro en lugar de fallar en runtime.

`SUPABASE_SECRET_KEY` es la API key moderna de Supabase (`sb_secret_xxx`). Si tu proyecto Supabase aun no migra a las nuevas API keys, define `SUPABASE_SERVICE_ROLE_KEY` (legacy JWT) y el schema la usara como fallback. Al menos una de las dos debe estar presente; si faltan ambas, el proceso aborta.

## Endpoints (referencia)

```
POST   /v1/summaries/medical-record    Genera/devuelve resumen de HC
POST   /v1/summaries/evolution         Genera/devuelve resumen de EM
GET    /v1/summaries/:kind/:entityId   Devuelve ultimo resumen cacheado
POST   /v1/conversations               Crea conversacion ligada a resumen
GET    /v1/conversations               Lista conversaciones del usuario
GET    /v1/conversations/:id           Detalle + mensajes
POST   /v1/conversations/:id/messages  SSE: stream del LLM
GET    /health                         Liveness
```

Todos requieren headers `X-Api-Key` y `Authorization: Bearer <jwt>`, salvo `/health`.
