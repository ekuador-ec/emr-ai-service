import type { Express } from "express";
import type { AppEnv } from "./env.js";
import { createSupabaseClient } from "../infrastructure/persistence/supabaseClient.js";
import { SupabaseApiClientRepository } from "../infrastructure/persistence/SupabaseApiClientRepository.js";
import { SupabaseSummaryRepository } from "../infrastructure/persistence/SupabaseSummaryRepository.js";
import { SupabaseConversationRepository } from "../infrastructure/persistence/SupabaseConversationRepository.js";
import { ArgonApiKeyValidator } from "../infrastructure/auth/ArgonApiKeyValidator.js";
import { SupabaseJwtValidator } from "../infrastructure/auth/SupabaseJwtValidator.js";
import { ServerSanitizer } from "../infrastructure/sanitization/ServerSanitizer.js";
import { MockLlmProvider } from "../infrastructure/llm/MockLlmProvider.js";
import { OpenRouterProvider } from "../infrastructure/llm/OpenRouterProvider.js";
import { DeepseekProvider } from "../infrastructure/llm/DeepseekProvider.js";
import { DefaultLlmRouter } from "../infrastructure/llm/DefaultLlmRouter.js";
import { PayloadHasher } from "../application/services/PayloadHasher.js";
import { PromptBuilder } from "../application/services/PromptBuilder.js";
import { GenerateSummaryUseCase } from "../application/use-cases/summaries/GenerateSummaryUseCase.js";
import { GetLatestSummaryUseCase } from "../application/use-cases/summaries/GetLatestSummaryUseCase.js";
import { StartConversationUseCase } from "../application/use-cases/conversations/StartConversationUseCase.js";
import { SendChatMessageUseCase } from "../application/use-cases/conversations/SendChatMessageUseCase.js";
import {
  DeleteConversationUseCase,
  GetConversationUseCase,
  ListConversationsUseCase
} from "../application/use-cases/conversations/ConversationQueryUseCases.js";
import { SummariesController } from "../presentation/http/controllers/summaries.controller.js";
import { ConversationsController } from "../presentation/http/controllers/conversations.controller.js";
import { buildAuthMiddleware } from "../presentation/http/middleware/authMiddleware.js";
import { buildRateLimiter } from "../presentation/http/middleware/rateLimiter.js";
import { buildApp } from "../presentation/http/app.js";
import type { LlmProvider } from "../domain/services/LlmProvider.js";
import { logger } from "../shared/logger.js";

export function buildContainer(env: AppEnv): Express {
  const db = createSupabaseClient({
    url: env.SUPABASE_URL,
    secretKey: env.SUPABASE_SECRET_KEY
  });

  const apiClients = new SupabaseApiClientRepository({ db });
  const summaries = new SupabaseSummaryRepository({ db });
  const conversations = new SupabaseConversationRepository({ db });

  const apiKeyValidator = new ArgonApiKeyValidator({ clients: apiClients });
  const jwtValidator = new SupabaseJwtValidator();

  const sanitizer = new ServerSanitizer();
  const hasher = new PayloadHasher();
  const prompts = new PromptBuilder({
    medicalRecord: env.PROMPT_VERSION_MEDICAL_RECORD,
    evolution: env.PROMPT_VERSION_EVOLUTION,
    chat: env.PROMPT_VERSION_CHAT,
    generalChat: env.PROMPT_VERSION_GENERAL_CHAT,
  });

  const fallback: LlmProvider = new MockLlmProvider({ model: "fallback-mock" });

  let deepseek: LlmProvider | null = null;
  if (env.DEEPSEEK_API_KEY) {
    deepseek = new DeepseekProvider({
      apiKey: env.DEEPSEEK_API_KEY,
      baseUrl: env.DEEPSEEK_BASE_URL,
      model: env.DEEPSEEK_MODEL
    });
  } else {
    logger.warn("DEEPSEEK_API_KEY missing; deepseek provider is disabled");
  }

  let openRouter: LlmProvider | null = null;
  if (env.OPENROUTER_API_KEY) {
    openRouter = new OpenRouterProvider({
      apiKey: env.OPENROUTER_API_KEY,
      baseUrl: env.OPENROUTER_BASE_URL,
      autoModels: env.OPENROUTER_AUTO_MODELS_LIST,
      siteUrl: env.OPENROUTER_SITE_URL,
      siteName: env.OPENROUTER_SITE_NAME
    });
  } else {
    logger.warn("OPENROUTER_API_KEY missing; openrouter provider is disabled");
  }

  if (!deepseek && !openRouter) {
    logger.warn("No real LLM provider configured; using MockLlmProvider as fallback");
  }

  const llmRouter = new DefaultLlmRouter({ deepseek, openRouter, fallback });

  const generateSummary = new GenerateSummaryUseCase({
    summaries,
    llmRouter,
    sanitizer,
    hasher,
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
    maxChatHistoryMessages: env.MAX_CHAT_HISTORY_MESSAGES
  });

  const authMiddleware = buildAuthMiddleware({ apiKeyValidator, jwtValidator });
  const rateLimiter = buildRateLimiter(env.RATE_LIMIT_PER_MINUTE);

  return buildApp({
    summariesController,
    conversationsController,
    authMiddleware,
    rateLimiter,
    trustProxy: env.NODE_ENV === "production" ? 1 : false,
    corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS_LIST,
  });
}
