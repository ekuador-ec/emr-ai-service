import { env } from "../src/config/env.js";

async function main(): Promise<void> {
  const r = await fetch(`${env.OPENROUTER_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
  });
  if (!r.ok) {
    console.error("status", r.status, await r.text());
    process.exit(1);
  }
  const data = (await r.json()) as { data: Array<{ id: string; name?: string; context_length?: number }> };
  const free = data.data
    .filter((m) => m.id.endsWith(":free"))
    .map((m) => ({ id: m.id, ctx: m.context_length ?? 0, name: m.name ?? "" }))
    .sort((a, b) => a.id.localeCompare(b.id));
  console.log(`Total free models: ${free.length}\n`);
  for (const m of free) console.log(`  ${m.id.padEnd(60)} ${String(m.ctx).padStart(7)} ctx`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
