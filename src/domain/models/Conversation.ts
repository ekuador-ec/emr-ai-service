import type { LlmProviderName, ModelPreference, SummaryKind } from "./Summary.js";

export type MessageRole = "system" | "user" | "assistant";

export interface AiMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  provider: LlmProviderName | null;
  model: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  createdAt: Date;
}

export interface AiConversation {
  id: string;
  clientId: string;
  summaryId: string | null;
  kind: SummaryKind;
  entityId: string;
  userId: string;
  title: string | null;
  modelPreference: ModelPreference;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationInput {
  clientId: string;
  summaryId: string | null;
  kind: SummaryKind;
  entityId: string;
  userId: string;
  title: string | null;
  modelPreference: ModelPreference;
}

export interface CreateMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  provider: LlmProviderName | null;
  model: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
}
