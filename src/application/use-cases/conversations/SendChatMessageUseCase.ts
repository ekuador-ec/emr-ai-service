import type { AiConversation, AiMessage } from "../../../domain/models/Conversation.js";
import type { ConversationRepository } from "../../../domain/repositories/ConversationRepository.js";
import type { SummaryRepository } from "../../../domain/repositories/SummaryRepository.js";
import type { LlmRouter, LlmStreamChunk } from "../../../domain/services/LlmProvider.js";
import type { PromptBuilder } from "../../services/PromptBuilder.js";
import { LlmProviderError, NotFoundError } from "../../../shared/errors.js";

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
  }
}
