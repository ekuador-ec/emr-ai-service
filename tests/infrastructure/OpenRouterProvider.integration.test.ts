import { describe, expect, it, beforeAll } from "vitest";
import { OpenRouterProvider } from "../../src/infrastructure/llm/OpenRouterProvider.js";

const apiKey = process.env["OPENROUTER_API_KEY"];
const runRealCalls = Boolean(apiKey);

describe.runIf(runRealCalls)("OpenRouterProvider (integracion, capa gratuita)", () => {
  let provider: OpenRouterProvider;

  beforeAll(() => {
    provider = new OpenRouterProvider({
      apiKey: apiKey ?? "",
      baseUrl: process.env["OPENROUTER_BASE_URL"] ?? "https://openrouter.ai/api/v1",
      autoModels: (
        process.env["OPENROUTER_AUTO_MODELS"] ??
        "deepseek/deepseek-chat-v3.1:free,google/gemini-2.0-flash-exp:free"
      )
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      siteUrl: process.env["OPENROUTER_SITE_URL"],
      siteName: process.env["OPENROUTER_SITE_NAME"] ?? "EMR AI Service Tests"
    });
  });

  it("genera una completion real con un modelo de la capa gratuita", async () => {
    const result = await provider.complete(
      [
        { role: "system", content: "Eres un asistente que responde en una sola palabra." },
        { role: "user", content: "Color del cielo de dia?" }
      ],
      { temperature: 0, maxTokens: 32 }
    );
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.provider).toBe("openrouter");
    expect(result.model).toBeTruthy();
  }, 45_000);

  it("transmite chunks via stream y consolida el contenido", async () => {
    const collected: string[] = [];
    const stream = await provider.stream(
      [
        { role: "system", content: "Responde con tres palabras separadas por coma." },
        { role: "user", content: "Tres colores primarios" }
      ],
      (chunk) => {
        if (chunk.delta) collected.push(chunk.delta);
      },
      { temperature: 0, maxTokens: 64 }
    );

    expect(collected.length).toBeGreaterThan(0);
    expect(stream.fullContent.length).toBeGreaterThan(0);
    expect(stream.fullContent).toBe(collected.join(""));
  }, 60_000);
});

describe.skipIf(runRealCalls)("OpenRouterProvider (integracion, skip sin API key)", () => {
  it("se ejecuta solo cuando OPENROUTER_API_KEY esta presente en el entorno", () => {
    expect(runRealCalls).toBe(false);
  });
});
