import { describe, expect, it } from "vitest";
import { StartConversationUseCase } from "../../src/application/use-cases/conversations/StartConversationUseCase.js";
import { SendChatMessageUseCase } from "../../src/application/use-cases/conversations/SendChatMessageUseCase.js";
import {
  ListConversationsUseCase,
  GetConversationUseCase,
  DeleteConversationUseCase
} from "../../src/application/use-cases/conversations/ConversationQueryUseCases.js";
import { PromptBuilder } from "../../src/application/services/PromptBuilder.js";
import { MockLlmProvider } from "../../src/infrastructure/llm/MockLlmProvider.js";
import { DefaultLlmRouter } from "../../src/infrastructure/llm/DefaultLlmRouter.js";
import { InMemoryConversationRepository } from "../fakes/InMemoryConversationRepository.js";
import { InMemorySummaryRepository } from "../fakes/InMemorySummaryRepository.js";
import { NotFoundError } from "../../src/shared/errors.js";

const CLIENT = "client-1";
const USER = "user-1";

function buildHarness(responder?: (input: { messages: Array<{ role: string; content: string }> }) => string) {
  const conversations = new InMemoryConversationRepository();
  const summaries = new InMemorySummaryRepository();
  const mock = new MockLlmProvider({
    responder: responder ?? (() => "Respuesta del asistente mock con varias palabras.")
  });
  const router = new DefaultLlmRouter({ deepseek: null, openRouter: null, fallback: mock });
  const prompts = new PromptBuilder({
    medicalRecord: "medical-record-v1",
    evolution: "evolution-v1",
    chat: "chat-system-v1"
  });

  const start = new StartConversationUseCase({ conversations, summaries });
  const send = new SendChatMessageUseCase({ conversations, summaries, llmRouter: router, prompts });
  const list = new ListConversationsUseCase({ conversations });
  const get = new GetConversationUseCase({ conversations });
  const del = new DeleteConversationUseCase({ conversations });

  return { conversations, summaries, start, send, list, get, del, mock };
}

describe("Conversation use cases", () => {
  it("inicia una conversacion enlazada al ultimo resumen del entityId", async () => {
    const h = buildHarness();
    const summary = await h.summaries.create({
      clientId: CLIENT,
      kind: "medical_record",
      entityId: "mr-1",
      payloadHash: "h",
      promptVersion: "medical-record-v1",
      provider: "mock",
      model: "mock-1",
      content: "Resumen base",
      tokensInput: 1,
      tokensOutput: 1,
      createdBy: USER
    });

    const { conversation } = await h.start.execute({
      clientId: CLIENT,
      userId: USER,
      summaryId: null,
      kind: "medical_record",
      entityId: "mr-1",
      title: null,
      modelPreference: "auto"
    });

    expect(conversation.summaryId).toBe(summary.id);
    expect(conversation.userId).toBe(USER);
  });

  it("rechaza summaryId que no pertenezca al cliente", async () => {
    const h = buildHarness();
    await expect(
      h.start.execute({
        clientId: CLIENT,
        userId: USER,
        summaryId: "non-existent",
        kind: "medical_record",
        entityId: "mr-1",
        title: null,
        modelPreference: "auto"
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("envia un mensaje, lo persiste y emite chunks al stream", async () => {
    const h = buildHarness();
    const { conversation } = await h.start.execute({
      clientId: CLIENT,
      userId: USER,
      summaryId: null,
      kind: "evolution",
      entityId: "ev-1",
      title: null,
      modelPreference: "auto"
    });

    const chunks: string[] = [];
    await h.send.execute(
      {
        clientId: CLIENT,
        userId: USER,
        conversationId: conversation.id,
        message: "Que diagnostico diferencial sugieres?",
        maxHistoryMessages: 20
      },
      {
        onChunk: (c) => {
          if (c.delta) chunks.push(c.delta);
        }
      }
    );

    expect(chunks.length).toBeGreaterThan(0);

    const { messages } = await h.get.execute({
      clientId: CLIENT,
      userId: USER,
      conversationId: conversation.id,
      messageLimit: 20
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("user");
    expect(messages[1]?.role).toBe("assistant");
    expect(messages[1]?.content).toContain("asistente mock");
  });

  it("respeta el aislamiento entre usuarios al recuperar conversaciones", async () => {
    const h = buildHarness();
    await h.start.execute({
      clientId: CLIENT,
      userId: USER,
      summaryId: null,
      kind: "medical_record",
      entityId: "mr-1",
      title: null,
      modelPreference: "auto"
    });

    const otherUserResult = await h.list.execute({
      clientId: CLIENT,
      userId: "user-2",
      limit: 10,
      offset: 0
    });
    expect(otherUserResult).toHaveLength(0);

    const myList = await h.list.execute({
      clientId: CLIENT,
      userId: USER,
      limit: 10,
      offset: 0
    });
    expect(myList).toHaveLength(1);
  });

  it("permite eliminar una conversacion del propio usuario", async () => {
    const h = buildHarness();
    const { conversation } = await h.start.execute({
      clientId: CLIENT,
      userId: USER,
      summaryId: null,
      kind: "evolution",
      entityId: "ev-1",
      title: null,
      modelPreference: "auto"
    });
    await h.del.execute({ clientId: CLIENT, userId: USER, conversationId: conversation.id });
    const remaining = await h.list.execute({ clientId: CLIENT, userId: USER, limit: 10, offset: 0 });
    expect(remaining).toHaveLength(0);
  });

  it("incluye el resumen previo como contexto del system prompt al chatear", async () => {
    let captured: Array<{ role: string; content: string }> = [];
    const h = buildHarness((input) => {
      captured = input.messages;
      return "ok";
    });

    const summary = await h.summaries.create({
      clientId: CLIENT,
      kind: "medical_record",
      entityId: "mr-1",
      payloadHash: "h",
      promptVersion: "medical-record-v1",
      provider: "mock",
      model: "mock-1",
      content: "RESUMEN DE REFERENCIA UNICO",
      tokensInput: 1,
      tokensOutput: 1,
      createdBy: USER
    });

    const { conversation } = await h.start.execute({
      clientId: CLIENT,
      userId: USER,
      summaryId: summary.id,
      kind: "medical_record",
      entityId: "mr-1",
      title: null,
      modelPreference: "auto"
    });

    await h.send.execute(
      {
        clientId: CLIENT,
        userId: USER,
        conversationId: conversation.id,
        message: "Sigue?",
        maxHistoryMessages: 20
      },
      { onChunk: () => {} }
    );

    const allContent = captured.map((m) => m.content).join("\n");
    expect(allContent).toContain("RESUMEN DE REFERENCIA UNICO");
  });
});
