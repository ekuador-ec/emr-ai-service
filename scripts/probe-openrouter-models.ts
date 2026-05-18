import { env } from "../src/config/env.js";
import { OpenRouterProvider } from "../src/infrastructure/llm/OpenRouterProvider.js";

const CANDIDATES = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-v4-flash:free",
  "google/gemma-4-31b-it:free",
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "z-ai/glm-4.5-air:free",
];

async function probe(model: string): Promise<{ model: string; ok: boolean; details: string }> {
  const provider = new OpenRouterProvider({
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: env.OPENROUTER_BASE_URL,
    autoModels: [model],
    siteUrl: env.OPENROUTER_SITE_URL,
    siteName: env.OPENROUTER_SITE_NAME ?? "EMR AI Smoke",
    defaultMaxTokens: 32,
  });
  try {
    const result = await provider.complete(
      [
        { role: "system", content: "Responde con UNA sola palabra." },
        { role: "user", content: "Color del cielo." },
      ],
      { model, temperature: 0, maxTokens: 16 },
    );
    return {
      model,
      ok: true,
      details: `tokens(in/out)=${result.tokensInput}/${result.tokensOutput} content="${result.content.trim().slice(0, 40)}"`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { model, ok: false, details: message.slice(0, 140) };
  }
}

async function main(): Promise<void> {
  console.log(`\nProbing ${CANDIDATES.length} OpenRouter free models...\n`);
  const results: Array<{ model: string; ok: boolean; details: string }> = [];
  for (const model of CANDIDATES) {
    const r = await probe(model);
    results.push(r);
    console.log(`  ${r.ok ? "[ OK ]" : "[FAIL]"} ${model}`);
    console.log(`         ${r.details}`);
  }
  console.log("\nResumen:");
  const okModels = results.filter((r) => r.ok).map((r) => r.model);
  const failedModels = results.filter((r) => !r.ok).map((r) => r.model);
  console.log(`  Working (${okModels.length}):`);
  for (const m of okModels) console.log(`    ${m}`);
  if (failedModels.length > 0) {
    console.log(`  Failed (${failedModels.length}):`);
    for (const m of failedModels) console.log(`    ${m}`);
  }
  if (okModels.length > 0) {
    console.log("\nSugerencia para OPENROUTER_AUTO_MODELS en .env:");
    console.log(`OPENROUTER_AUTO_MODELS=${okModels.slice(0, 4).join(",")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
