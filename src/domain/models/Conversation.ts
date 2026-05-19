import type { LlmProviderName, ModelPreference, SummaryKind } from "./Summary.js";

export type MessageRole = "system" | "user" | "assistant";

/**
 * Las conversaciones pueden estar atadas a una HC ('medical_record'),
 * a una EM ('evolution') o ser libres ('general' = el usuario consulta
 * dudas medicas sin entityId).
 */
export type ConversationKind = SummaryKind | "general";

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
  kind: ConversationKind;
  entityId: string | null;
  userId: string;
  title: string | null;
  modelPreference: ModelPreference;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationInput {
  clientId: string;
  summaryId: string | null;
  kind: ConversationKind;
  entityId: string | null;
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
