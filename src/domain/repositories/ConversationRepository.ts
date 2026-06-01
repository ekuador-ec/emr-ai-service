import type {
  AiConversation,
  AiMessage,
  CreateConversationInput,
  CreateMessageInput
} from "../models/Conversation.js";
import type { ModelPreference } from "../models/Summary.js";

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

export interface UpdatePreferenceInput {
  clientId: string;
  conversationId: string;
  modelPreference: ModelPreference;
}

export interface UpdateTitleInput {
  clientId: string;
  conversationId: string;
  title: string;
}

export interface ConversationRepository {
  create(input: CreateConversationInput): Promise<AiConversation>;
  findById(clientId: string, conversationId: string): Promise<AiConversation | null>;
  listForUser(query: ListConversationsQuery): Promise<AiConversation[]>;
  delete(clientId: string, conversationId: string): Promise<void>;
  updatePreference(input: UpdatePreferenceInput): Promise<AiConversation>;
  updateTitle(input: UpdateTitleInput): Promise<AiConversation>;
  appendMessage(input: CreateMessageInput): Promise<AiMessage>;
  listMessages(query: ListMessagesQuery): Promise<AiMessage[]>;
}
