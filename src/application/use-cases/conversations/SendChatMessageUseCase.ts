import type { AiConversation, AiMessage } from "../../../domain/models/Conversation.js";
import type { ConversationRepository } from "../../../domain/repositories/ConversationRepository.js";
import type { SummaryRepository } from "../../../domain/repositories/SummaryRepository.js";
import type { LlmRouter, LlmStreamChunk } from "../../../domain/services/LlmProvider.js";
import type { PromptBuilder } from "../../services/PromptBuilder.js";
import { LlmProviderError, NotFoundError } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";

const MAX_TITLE_LENGTH = 80;

function sanitizeTitle(raw: string): string | null {
  const firstLine = raw.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  const cleaned = firstLine
    .replace(/^["'`*#\s-]+/, "")
    .replace(/["'`*\s.]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_TITLE_LENGTH ? `${cleaned.slice(0, MAX_TITLE_LENGTH).trim()}...` : cleaned;
}

export interface SendChatMessageInput {
  clientId: string;
  userId: string;
  conversationId: string;
  message: string;
  maxHistoryMessages: number;
}

export interface SendChatMessageStreamHandlers {
  onConversation?: (conversation: AiConversation) => void;
  onChunk: (chunk: LlmStreamChunk) => void;
  onCompleted?: (userMessage: AiMessage, assistantMessage: AiMessage) => void;
  onTitle?: (conversation: AiConversation) => void;
}

export class SendChatMessageUseCase {
  private readonly conversations: ConversationRepository;
  private readonly summaries: SummaryRepository;
  private readonly llmRouter: LlmRouter;
  private readonly prompts: PromptBuilder;

  constructor(deps: {
    conversations: ConversationRepository;
    summaries: SummaryRepository;
    llmRouter: LlmRouter;
    prompts: PromptBuilder;
  }) {
    this.conversations = deps.conversations;
    this.summaries = deps.summaries;
    this.llmRouter = deps.llmRouter;
    this.prompts = deps.prompts;
  }

  async execute(input: SendChatMessageInput, handlers: SendChatMessageStreamHandlers): Promise<void> {
    const conversation = await this.conversations.findById(input.clientId, input.conversationId);
    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }
    if (conversation.userId !== input.userId) {
      throw new NotFoundError("Conversation not accessible by this user");
    }

    handlers.onConversation?.(conversation);

    const summary = conversation.summaryId
      ? await this.summaries.findById(input.clientId, conversation.summaryId)
      : null;

    const previousMessages = await this.conversations.listMessages({
      conversationId: conversation.id,
      limit: input.maxHistoryMessages
    });

    const history = previousMessages.map((m) => ({ role: m.role, content: m.content }));
    const messages = this.prompts.buildChatMessages(
      conversation.kind,
      summary?.content ?? null,
      history,
      input.message,
    );

    const userMessage = await this.conversations.appendMessage({
      conversationId: conversation.id,
      role: "user",
      content: input.message,
      provider: null,
      model: null,
      tokensInput: null,
      tokensOutput: null
    });

    const provider = this.llmRouter.pick(conversation.modelPreference);

    let result;
    try {
      result = await provider.stream(messages, handlers.onChunk, { temperature: 0.3 });
    } catch (error) {
      throw new LlmProviderError(
        error instanceof Error ? error.message : "LLM stream failed",
        { providerName: provider.name }
      );
    }

    const assistantMessage = await this.conversations.appendMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: result.fullContent,
      provider: result.provider,
      model: result.model,
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput
    });

    handlers.onCompleted?.(userMessage, assistantMessage);

    const isFirstExchange = previousMessages.length === 0;
    if (conversation.kind === "general" && isFirstExchange) {
      await this.generateTitle(conversation, input.message, result.fullContent, provider, handlers);
    }
  }

  private async generateTitle(
    conversation: AiConversation,
    firstUserMessage: string,
    assistantReply: string,
    provider: ReturnType<LlmRouter["pick"]>,
    handlers: SendChatMessageStreamHandlers,
  ): Promise<void> {
    try {
      const titleMessages = this.prompts.buildTitleMessages(firstUserMessage, assistantReply);
      const completion = await provider.complete(titleMessages, { temperature: 0.2, maxTokens: 24 });
      const title = sanitizeTitle(completion.content);
      if (!title) return;

      const updated = await this.conversations.updateTitle({
        clientId: conversation.clientId,
        conversationId: conversation.id,
        title,
      });
      handlers.onTitle?.(updated);
    } catch (error) {
      logger.warn(
        { conversationId: conversation.id, err: error instanceof Error ? error.message : "unknown" },
        "auto title generation failed",
      );
    }
  }
}
