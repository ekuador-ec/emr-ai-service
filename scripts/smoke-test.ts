#!/usr/bin/env node
/**
 * scripts/smoke-test.ts
 *
 * Verifica de extremo a extremo que el AI service tiene credenciales validas:
 *  1. Conecta a Supabase con la secret key y consulta tablas internas.
 *  2. Llama a OpenRouter con un prompt minimo y muestra el modelo que respondio.
 *  3. (Opcional) Llama a DeepSeek directo si DEEPSEEK_API_KEY esta configurada.
 *
 * Ejecutar con:
 *   pnpm exec tsx scripts/smoke-test.ts
 */

import { env } from "../src/config/env.js";
import { createSupabaseClient } from "../src/infrastructure/persistence/supabaseClient.js";
import { OpenRouterProvider } from "../src/infrastructure/llm/OpenRouterProvider.js";
import { DeepseekProvider } from "../src/infrastructure/llm/DeepseekProvider.js";

const TABLES = ["api_clients", "ai_summaries", "ai_conversations", "ai_messages"] as const;

type CheckResult = { name: string; status: "ok" | "warn" | "fail"; details?: string };

const results: CheckResult[] = [];

function header(title: string): void {
  console.log(`\n${"=".repeat(70)}\n  ${title}\n${"=".repeat(70)}`);
}

function step(message: string): void {
  console.log(`  -> ${message}`);
}

function report(name: string, status: CheckResult["status"], details?: string): void {
  const icon = status === "ok" ? "[ OK ]" : status === "warn" ? "[WARN]" : "[FAIL]";
  console.log(`  ${icon} ${name}${details ? ` -- ${details}` : ""}`);
  results.push({ name, status, details });
}

async function checkSupabase(): Promise<void> {
  header("1) Supabase");
  step(`URL: ${env.SUPABASE_URL}`);
  const usingLegacy = !env.SUPABASE_SECRET_KEY.startsWith("sb_secret_");
  step(`Secret key format: ${usingLegacy ? "legacy JWT (service_role)" : "modern (sb_secret_xxx)"}`);

  const db = createSupabaseClient({ url: env.SUPABASE_URL, secretKey: env.SUPABASE_SECRET_KEY });

  for (const table of TABLES) {
    try {
      const { count, error } = await db
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) {
        report(`table public.${table}`, "fail", error.message);
      } else {
        report(`table public.${table}`, "ok", `${count ?? 0} row(s)`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      report(`table public.${table}`, "fail", message);
    }
  }

  try {
    const { count: clientCount } = await db
      .from("api_clients")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);
    if ((clientCount ?? 0) === 0) {
      report(
        "active api_clients",
        "warn",
        "no tenants registered yet -- crea uno antes de probar el endpoint HTTP",
      );
    } else {
      report("active api_clients", "ok", `${clientCount} tenant(s) activos`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report("active api_clients", "fail", message);
  }
}

async function checkOpenRouter(): Promise<void> {
  header("2) OpenRouter");
  if (!env.OPENROUTER_API_KEY) {
    report("OPENROUTER_API_KEY", "warn", "no configurada, skipping");
    return;
  }
  step(`Base URL: ${env.OPENROUTER_BASE_URL}`);
  step(`Auto models pool: ${env.OPENROUTER_AUTO_MODELS_LIST.join(", ")}`);

  const provider = new OpenRouterProvider({
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: env.OPENROUTER_BASE_URL,
    autoModels: env.OPENROUTER_AUTO_MODELS_LIST,
    siteUrl: env.OPENROUTER_SITE_URL,
    siteName: env.OPENROUTER_SITE_NAME ?? "EMR AI Smoke Test",
    defaultMaxTokens: 64,
  });

  try {
    const result = await provider.complete(
      [
        { role: "system", content: "Responde unicamente con una sola palabra." },
        { role: "user", content: "Color del cielo de dia?" },
      ],
      { temperature: 0, maxTokens: 32 },
    );
    report(
      "complete()",
      "ok",
      `modelo=${result.model} | tokens(in/out)=${result.tokensInput}/${result.tokensOutput} | content="${result.content.trim().slice(0, 60)}"`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report("complete()", "fail", message);
    return;
  }

  try {
    const chunks: string[] = [];
    const stream = await provider.stream(
      [
        { role: "system", content: "Responde con tres palabras separadas por coma." },
        { role: "user", content: "Tres colores primarios" },
      ],
      (chunk) => {
        if (chunk.delta) chunks.push(chunk.delta);
      },
      { temperature: 0, maxTokens: 48 },
    );
    report(
      "stream()",
      "ok",
      `modelo=${stream.model} | chunks=${chunks.length} | content="${stream.fullContent.trim().slice(0, 60)}"`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report("stream()", "fail", message);
  }
}

async function checkDeepseek(): Promise<void> {
  header("3) DeepSeek (opcional)");
  if (!env.DEEPSEEK_API_KEY) {
    report("DEEPSEEK_API_KEY", "warn", "no configurada, skipping");
    return;
  }
  step(`Base URL: ${env.DEEPSEEK_BASE_URL} | modelo=${env.DEEPSEEK_MODEL}`);

  const provider = new DeepseekProvider({
    apiKey: env.DEEPSEEK_API_KEY,
    baseUrl: env.DEEPSEEK_BASE_URL,
    model: env.DEEPSEEK_MODEL,
    defaultMaxTokens: 32,
  });

  try {
    const result = await provider.complete(
      [
        { role: "system", content: "Responde unicamente con una sola palabra." },
        { role: "user", content: "Color del cielo de dia?" },
      ],
      { temperature: 0, maxTokens: 32 },
    );
    report(
      "complete()",
      "ok",
      `modelo=${result.model} | tokens(in/out)=${result.tokensInput}/${result.tokensOutput} | content="${result.content.trim().slice(0, 60)}"`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report("complete()", "fail", message);
  }
}

async function main(): Promise<void> {
  console.log(`\nEMR AI Service - Smoke test\nNODE_ENV=${env.NODE_ENV}\n`);

  await checkSupabase();
  await checkOpenRouter();
  await checkDeepseek();

  header("Resumen");
  const ok = results.filter((r) => r.status === "ok").length;
  const warn = results.filter((r) => r.status === "warn").length;
  const fail = results.filter((r) => r.status === "fail").length;
  console.log(`  ok: ${ok}   warn: ${warn}   fail: ${fail}\n`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\nSmoke test fatal error:", err);
  process.exit(2);
});
