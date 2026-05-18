#!/usr/bin/env node
/**
 * scripts/create-api-client.ts
 *
 * Genera un par <prefix>.<secret> nuevo, hashea el secret con argon2id y crea
 * el row correspondiente en la tabla public.api_clients del Supabase del AI service.
 * Imprime el API key PLANO una sola vez al final: copialo a la variable de entorno
 * VITE_AI_SERVICE_API_KEY del frontend; el AI service ya no podra recuperarlo.
 *
 * Uso:
 *   pnpm exec tsx scripts/create-api-client.ts --name "<nombre>" --jwks-url "<url>"
 *
 * Argumentos:
 *   --name      Etiqueta legible del tenant (ej. "EMR Local Dev")
 *   --jwks-url  URL JWKS del Supabase del EMR cliente,
 *               normalmente https://<emr-project>.supabase.co/auth/v1/.well-known/jwks.json
 *   --audience  (opcional) audience esperada en el JWT del usuario
 */

import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { env } from "../src/config/env.js";
import { createSupabaseClient } from "../src/infrastructure/persistence/supabaseClient.js";

interface CliArgs {
  name: string;
  jwksUrl: string;
  audience: string | null;
}

function parseArgs(): CliArgs {
  const out: Partial<CliArgs> = { audience: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag || !value) continue;
    if (flag === "--name") out.name = value;
    else if (flag === "--jwks-url") out.jwksUrl = value;
    else if (flag === "--audience") out.audience = value;
    i++;
  }
  if (!out.name || !out.jwksUrl) {
    console.error("Uso: pnpm exec tsx scripts/create-api-client.ts --name <name> --jwks-url <url> [--audience <aud>]");
    process.exit(1);
  }
  return { name: out.name, jwksUrl: out.jwksUrl, audience: out.audience ?? null };
}

async function main(): Promise<void> {
  const args = parseArgs();

  const prefix = `eai_${randomBytes(6).toString("hex")}`;
  const secret = randomBytes(24).toString("base64url");
  const hash = await argon2.hash(secret, { type: argon2.argon2id });

  const db = createSupabaseClient({
    url: env.SUPABASE_URL,
    secretKey: env.SUPABASE_SECRET_KEY,
  });

  const { data, error } = await db
    .from("api_clients")
    .insert({
      name: args.name,
      api_key_prefix: prefix,
      api_key_hash: hash,
      jwks_url: args.jwksUrl,
      audience: args.audience,
      is_active: true,
    })
    .select("id, name, api_key_prefix, jwks_url, audience, is_active, created_at")
    .single();

  if (error || !data) {
    console.error("Error creando api_client:", error?.message ?? "unknown");
    process.exit(1);
  }

  const apiKey = `${prefix}.${secret}`;

  console.log("\nApi client creado:");
  console.log(`  id          ${data.id}`);
  console.log(`  name        ${data.name}`);
  console.log(`  prefix      ${data.api_key_prefix}`);
  console.log(`  jwks_url    ${data.jwks_url}`);
  console.log(`  audience    ${data.audience ?? "<null>"}`);
  console.log(`  is_active   ${data.is_active}`);
  console.log("\n=== API KEY (mostrada UNA SOLA VEZ, copiala ya) ===");
  console.log(`\n  ${apiKey}\n`);
  console.log("Pegala en .env del frontend EMR:");
  console.log(`  VITE_AI_SERVICE_API_KEY=${apiKey}\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
