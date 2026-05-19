import { describe, expect, it } from "vitest";
import { GenerateSummaryUseCase } from "../../src/application/use-cases/summaries/GenerateSummaryUseCase.js";
import { PayloadHasher } from "../../src/application/services/PayloadHasher.js";
import { PromptBuilder } from "../../src/application/services/PromptBuilder.js";
import { MockLlmProvider } from "../../src/infrastructure/llm/MockLlmProvider.js";
import { DefaultLlmRouter } from "../../src/infrastructure/llm/DefaultLlmRouter.js";
import { ServerSanitizer } from "../../src/infrastructure/sanitization/ServerSanitizer.js";
import { InMemorySummaryRepository } from "../fakes/InMemorySummaryRepository.js";

function buildUseCase(responder?: (input: { messages: Array<{ role: string; content: string }> }) => string) {
  const mock = new MockLlmProvider({
    responder: responder ?? (() => "Resumen mock detallado del paciente.")
  });
  const router = new DefaultLlmRouter({ deepseek: null, openRouter: null, fallback: mock });
  const summaries = new InMemorySummaryRepository();
  const useCase = new GenerateSummaryUseCase({
    summaries,
    llmRouter: router,
    sanitizer: new ServerSanitizer(),
    hasher: new PayloadHasher(),
    prompts: new PromptBuilder({
      medicalRecord: "medical-record-v1",
      evolution: "evolution-v1",
      chat: "chat-system-v1",
      generalChat: "general-chat-v1",
    })
  });
  return { useCase, summaries, mock };
}

describe("GenerateSummaryUseCase", () => {
  const baseInput = {
    clientId: "client-1",
    userId: "user-1",
    kind: "medical_record" as const,
    entityId: "mr-1",
    preference: "auto" as const
  };

  it("genera y persiste un resumen cuando no hay cache previo", async () => {
    const { useCase, summaries } = buildUseCase();
    const result = await useCase.execute({
      ...baseInput,
      payload: { patientId: "p1", clinicalNotes: "Sin novedades" }
    });

    expect(result.cached).toBe(false);
    expect(result.summary.content).toContain("Resumen mock");
    expect(result.summary.provider).toBe("mock");
    expect(summaries.snapshot()).toHaveLength(1);
  });

  it("reutiliza el resumen cacheado en una segunda llamada con el mismo payload", async () => {
    const { useCase, summaries } = buildUseCase();
    const payload = { patientId: "p1", clinicalNotes: "Sin novedades" };

    const first = await useCase.execute({ ...baseInput, payload });
    const second = await useCase.execute({ ...baseInput, payload });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.summary.id).toBe(first.summary.id);
    expect(summaries.snapshot()).toHaveLength(1);
  });

  it("genera un nuevo resumen cuando el payload cambia", async () => {
    const { useCase, summaries } = buildUseCase();
    await useCase.execute({ ...baseInput, payload: { patientId: "p1", v: 1 } });
    await useCase.execute({ ...baseInput, payload: { patientId: "p1", v: 2 } });
    expect(summaries.snapshot()).toHaveLength(2);
  });

  it("sanitiza PII antes de pasarla al provider", async () => {
    let capturedMessages: Array<{ role: string; content: string }> = [];
    const { useCase } = buildUseCase((input) => {
      capturedMessages = input.messages;
      return "ok";
    });

    await useCase.execute({
      ...baseInput,
      payload: {
        patientId: "p1",
        firstName: "Juan",
        lastName: "Perez",
        notes: "Contactar a paciente al 0991234567"
      }
    });

    const userContent = capturedMessages.find((m) => m.role === "user")?.content ?? "";
    expect(userContent).not.toContain("Juan");
    expect(userContent).not.toContain("Perez");
    expect(userContent).not.toContain("0991234567");
    expect(userContent).toContain("[REDACTED]");
  });

  it("expone un conteo de findings de sanitizacion", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.execute({
      ...baseInput,
      payload: { firstName: "Juan", lastName: "Perez", patientId: "p1" }
    });
    expect(result.sanitizationFindings).toBeGreaterThanOrEqual(2);
  });

  it("forceRefresh ignora el cache y crea un nuevo resumen", async () => {
    const { useCase, summaries } = buildUseCase();
    const payload = { patientId: "p1", info: "x" };
    await useCase.execute({ ...baseInput, payload });
    await useCase.execute({ ...baseInput, payload, forceRefresh: true });
    expect(summaries.snapshot()).toHaveLength(2);
  });
});
