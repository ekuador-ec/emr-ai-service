import type {
  AiConversation,
  AiMessage,
  CreateConversationInput,
  CreateMessageInput
} from "../models/Conversation.js";

export interface ListConversationsQuery {
  clientId: string;
  userId: string;
  limit: number;
  offset: number;
}

export interface ListMessagesQuery {
  conversationId: string;
  limit: number;
}

export interface ConversationRepository {
  create(input: CreateConversationInput): Promise<AiConversation>;
  findById(clientId: string, conversationId: string): Promise<AiConversation | null>;
  listForUser(query: ListConversationsQuery): Promise<AiConversation[]>;
  delete(clientId: string, conversationId: string): Promise<void>;
  appendMessage(input: CreateMessageInput): Promise<AiMessage>;
  listMessages(query: ListMessagesQuery): Promise<AiMessage[]>;
}
