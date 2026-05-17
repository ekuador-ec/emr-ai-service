import { randomUUID } from "node:crypto";
import type {
  AiConversation,
  AiMessage,
  CreateConversationInput,
  CreateMessageInput
} from "../../src/domain/models/Conversation.js";
import type {
  ConversationRepository,
  ListConversationsQuery,
  ListMessagesQuery
} from "../../src/domain/repositories/ConversationRepository.js";

export class InMemoryConversationRepository implements ConversationRepository {
  private readonly conversations: AiConversation[] = [];
  private readonly messages: AiMessage[] = [];

  async create(input: CreateConversationInput): Promise<AiConversation> {
    const now = new Date();
    const conversation: AiConversation = {
      id: randomUUID(),
      clientId: input.clientId,
      summaryId: input.summaryId,
      kind: input.kind,
      entityId: input.entityId,
      userId: input.userId,
      title: input.title,
      modelPreference: input.modelPreference,
      createdAt: now,
      updatedAt: now
    };
    this.conversations.push(conversation);
    return conversation;
  }

  async findById(clientId: string, conversationId: string): Promise<AiConversation | null> {
    return this.conversations.find((c) => c.id === conversationId && c.clientId === clientId) ?? null;
  }

  async listForUser(query: ListConversationsQuery): Promise<AiConversation[]> {
    const filtered = this.conversations
      .filter((c) => c.clientId === query.clientId && c.userId === query.userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return filtered.slice(query.offset, query.offset + query.limit);
  }

  async delete(clientId: string, conversationId: string): Promise<void> {
    const idx = this.conversations.findIndex((c) => c.id === conversationId && c.clientId === clientId);
    if (idx >= 0) this.conversations.splice(idx, 1);
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i]?.conversationId === conversationId) this.messages.splice(i, 1);
    }
  }

  async appendMessage(input: CreateMessageInput): Promise<AiMessage> {
    const message: AiMessage = {
      id: randomUUID(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      provider: input.provider,
      model: input.model,
      tokensInput: input.tokensInput,
      tokensOutput: input.tokensOutput,
      createdAt: new Date()
    };
    this.messages.push(message);

    const conv = this.conversations.find((c) => c.id === input.conversationId);
    if (conv) conv.updatedAt = new Date();
    return message;
  }

  async listMessages(query: ListMessagesQuery): Promise<AiMessage[]> {
    return this.messages
      .filter((m) => m.conversationId === query.conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-query.limit);
  }
}
