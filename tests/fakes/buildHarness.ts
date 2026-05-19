import type { NextFunction, RequestHandler, Response } from "express";
import type { ApiClient } from "../../src/domain/models/ApiClient.js";
import type {
  AuthenticatedContext
} from "../../src/domain/services/Auth.js";
import type { RequestWithAuth } from "../../src/presentation/http/middleware/authMiddleware.js";
import { GenerateSummaryUseCase } from "../../src/application/use-cases/summaries/GenerateSummaryUseCase.js";
import { GetLatestSummaryUseCase } from "../../src/application/use-cases/summaries/GetLatestSummaryUseCase.js";
import { StartConversationUseCase } from "../../src/application/use-cases/conversations/StartConversationUseCase.js";
import { SendChatMessageUseCase } from "../../src/application/use-cases/conversations/SendChatMessageUseCase.js";
import {
  DeleteConversationUseCase,
  GetConversationUseCase,
  ListConversationsUseCase
} from "../../src/application/use-cases/conversations/ConversationQueryUseCases.js";
import { PayloadHasher } from "../../src/application/services/PayloadHasher.js";
import { PromptBuilder } from "../../src/application/services/PromptBuilder.js";
import { ServerSanitizer } from "../../src/infrastructure/sanitization/ServerSanitizer.js";
import { MockLlmProvider } from "../../src/infrastructure/llm/MockLlmProvider.js";
import { DefaultLlmRouter } from "../../src/infrastructure/llm/DefaultLlmRouter.js";
import { SummariesController } from "../../src/presentation/http/controllers/summaries.controller.js";
import { ConversationsController } from "../../src/presentation/http/controllers/conversations.controller.js";
import { buildApp } from "../../src/presentation/http/app.js";
import { InMemorySummaryRepository } from "./InMemorySummaryRepository.js";
import { InMemoryConversationRepository } from "./InMemoryConversationRepository.js";

export interface TestHarness {
  app: ReturnType<typeof buildApp>;
  summaries: InMemorySummaryRepository;
  conversations: InMemoryConversationRepository;
  mockProvider: MockLlmProvider;
  client: ApiClient;
  userId: string;
  setAuth(ctx: AuthenticatedContext): void;
}

export interface BuildHarnessOptions {
  responder?: (input: { messages: Array<{ role: string; content: string }> }) => string;
  promptVersions?: { medicalRecord: string; evolution: string; chat: string; generalChat: string };
}

const DEFAULT_PROMPT_VERSIONS = {
  medicalRecord: "medical-record-v1",
  evolution: "evolution-v1",
  chat: "chat-system-v1",
  generalChat: "general-chat-v1",
};

export function buildHarness(options: BuildHarnessOptions = {}): TestHarness {
  const summaries = new InMemorySummaryRepository();
  const conversations = new InMemoryConversationRepository();
  const mockProvider = new MockLlmProvider({
    responder: options.responder ?? (() => "Resumen mock con varios tokens en la respuesta.")
  });

  const llmRouter = new DefaultLlmRouter({
    deepseek: null,
    openRouter: null,
    fallback: mockProvider
  });
  const prompts = new PromptBuilder(options.promptVersions ?? DEFAULT_PROMPT_VERSIONS);

  const generateSummary = new GenerateSummaryUseCase({
    summaries,
    llmRouter,
    sanitizer: new ServerSanitizer(),
    hasher: new PayloadHasher(),
    prompts
  });
  const getLatestSummary = new GetLatestSummaryUseCase({ summaries });
  const startConversation = new StartConversationUseCase({ conversations, summaries });
  const sendChatMessage = new SendChatMessageUseCase({
    conversations,
    summaries,
    llmRouter,
    prompts
  });
  const listConversations = new ListConversationsUseCase({ conversations });
  const getConversation = new GetConversationUseCase({ conversations });
  const deleteConversation = new DeleteConversationUseCase({ conversations });

  const summariesController = new SummariesController({ generateSummary, getLatestSummary });
  const conversationsController = new ConversationsController({
    startConversation,
    sendChatMessage,
    listConversations,
    getConversation,
    deleteConversation,
    maxChatHistoryMessages: 20
  });

  const client: ApiClient = {
    id: "11111111-1111-1111-1111-111111111111",
    name: "test-tenant",
    apiKeyPrefix: "eai_test",
    apiKeyHash: "$argon2id$fake",
    jwksUrl: "https://example.invalid/jwks",
    audience: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  let currentAuth: AuthenticatedContext = {
    client,
    userId: "22222222-2222-2222-2222-222222222222",
    userRole: "doctor"
  };

  const fakeAuth: RequestHandler = (req: RequestWithAuth, _res: Response, next: NextFunction) => {
    req.auth = currentAuth;
    next();
  };

  const app = buildApp({
    summariesController,
    conversationsController,
    authMiddleware: fakeAuth
  });

  return {
    app,
    summaries,
    conversations,
    mockProvider,
    client,
    userId: currentAuth.userId,
    setAuth(ctx: AuthenticatedContext) {
      currentAuth = ctx;
    }
  };
}
