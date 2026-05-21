import type { AiConversation, AiMessage } from "../../../domain/models/Conversation.js";
import type { ConversationRepository } from "../../../domain/repositories/ConversationRepository.js";
import type { ModelPreference } from "../../../domain/models/Summary.js";
import { NotFoundError } from "../../../shared/errors.js";

export interface ListConversationsInput {
  clientId: string;
  userId: string;
  limit: number;
  offset: number;
}

export interface GetConversationInput {
  clientId: string;
  userId: string;
  conversationId: string;
  messageLimit: number;
}

export class ListConversationsUseCase {
  private readonly conversations: ConversationRepository;
  constructor(deps: { conversations: ConversationRepository }) {
    this.conversations = deps.conversations;
  }
  async execute(input: ListConversationsInput): Promise<AiConversation[]> {
    return this.conversations.listForUser(input);
  }
}

export class GetConversationUseCase {
  private readonly conversations: ConversationRepository;
  constructor(deps: { conversations: ConversationRepository }) {
    this.conversations = deps.conversations;
  }
  async execute(
    input: GetConversationInput
  ): Promise<{ conversation: AiConversation; messages: AiMessage[] }> {
    const conversation = await this.conversations.findById(input.clientId, input.conversationId);
    if (!conversation || conversation.userId !== input.userId) {
      throw new NotFoundError("Conversation not found");
    }
    const messages = await this.conversations.listMessages({
      conversationId: conversation.id,
      limit: input.messageLimit
    });
    return { conversation, messages };
  }
}

export class DeleteConversationUseCase {
  private readonly conversations: ConversationRepository;
  constructor(deps: { conversations: ConversationRepository }) {
    this.conversations = deps.conversations;
  }
  async execute(input: { clientId: string; userId: string; conversationId: string }): Promise<void> {
    const conversation = await this.conversations.findById(input.clientId, input.conversationId);
    if (!conversation || conversation.userId !== input.userId) {
      throw new NotFoundError("Conversation not found");
    }
    await this.conversations.delete(input.clientId, conversation.id);
  }
}

export interface UpdateConversationPreferenceInput {
  clientId: string;
  userId: string;
  conversationId: string;
  modelPreference: ModelPreference;
}

export class UpdateConversationPreferenceUseCase {
  private readonly conversations: ConversationRepository;
  constructor(deps: { conversations: ConversationRepository }) {
    this.conversations = deps.conversations;
  }
  async execute(input: UpdateConversationPreferenceInput): Promise<AiConversation> {
    const conversation = await this.conversations.findById(input.clientId, input.conversationId);
    if (!conversation || conversation.userId !== input.userId) {
      throw new NotFoundError("Conversation not found");
    }
    return this.conversations.updatePreference({
      clientId: input.clientId,
      conversationId: conversation.id,
      modelPreference: input.modelPreference,
    });
  }
}
