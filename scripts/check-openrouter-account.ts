import { env } from "../src/config/env.js";

interface ModelEntry {
  id: string;
  name?: string;
  context_length?: number;
}

interface AuthInfo {
  data?: {
    label?: string;
    usage?: number;
    limit?: number | null;
    is_free_tier?: boolean;
    rate_limit?: { requests?: number; interval?: string };
  };
}

async function main(): Promise<void> {
  console.log(`Using API key prefix: ${env.OPENROUTER_API_KEY.slice(0, 12)}...\n`);

  const authRes = await fetch(`${env.OPENROUTER_BASE_URL}/auth/key`, {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
  });
  if (!authRes.ok) {
    console.error(`auth/key failed: ${authRes.status} ${await authRes.text()}`);
  } else {
    const auth = (await authRes.json()) as AuthInfo;
    console.log("=== Cuenta ===");
    console.log(`  label:        ${auth.data?.label ?? "(unset)"}`);
    console.log(`  is_free_tier: ${auth.data?.is_free_tier ?? "?"}`);
    console.log(`  usage:        ${auth.data?.usage ?? 0} credits`);
    console.log(`  limit:        ${auth.data?.limit ?? "(null = no hard limit)"}`);
    if (auth.data?.rate_limit) {
      console.log(
        `  rate_limit:   ${auth.data.rate_limit.requests} requests / ${auth.data.rate_limit.interval}`,
      );
    }
  }

  console.log("\n=== Buscando 'openrouter/free' en el catalogo ===");
  const r = await fetch(`${env.OPENROUTER_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
  });
  if (!r.ok) {
    console.error(`models failed: ${r.status}`);
    process.exit(1);
  }
  const data = (await r.json()) as { data: ModelEntry[] };
  const hits = data.data.filter((m) => m.id === "openrouter/free" || m.id.startsWith("openrouter/"));
  if (hits.length === 0) {
    console.log("  No se encontro 'openrouter/free' ni ningun id openrouter/* en el catalogo.");
  } else {
    for (const h of hits) {
      console.log(`  ${h.id.padEnd(40)} ctx=${h.context_length ?? "?"} name=${h.name ?? "?"}`);
    }
  }

  console.log("\n=== Probando openrouter/free con un prompt minimo ===");
  try {
    const start = Date.now();
    const probe = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          { role: "system", content: "Responde con UNA sola palabra." },
          { role: "user", content: "Color del cielo de dia." },
        ],
        temperature: 0,
        max_tokens: 16,
      }),
    });
    const took = Date.now() - start;
    const text = await probe.text();
    if (!probe.ok) {
      console.log(`  status=${probe.status} took=${took}ms body=${text.slice(0, 400)}`);
    } else {
      const parsed = JSON.parse(text) as {
        model: string;
        choices: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      console.log(`  status=${probe.status} took=${took}ms`);
      console.log(`  resolved model: ${parsed.model}`);
      console.log(`  content:        "${parsed.choices[0]?.message?.content ?? ""}"`);
      console.log(
        `  tokens:         in=${parsed.usage?.prompt_tokens ?? "?"} out=${parsed.usage?.completion_tokens ?? "?"}`,
      );
    }
  } catch (err) {
    console.error(`  fetch error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
