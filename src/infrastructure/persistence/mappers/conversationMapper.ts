import type {
  AiConversation,
  AiMessage,
  ConversationKind,
  MessageRole
} from "../../../domain/models/Conversation.js";
import type {
  LlmProviderName,
  ModelPreference
} from "../../../domain/models/Summary.js";

export interface ConversationRow {
  id: string;
  client_id: string;
  summary_id: string | null;
  kind: string;
  entity_id: string | null;
  user_id: string;
  title: string | null;
  model_preference: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  provider: string | null;
  model: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  created_at: string;
}

export function toConversation(row: ConversationRow): AiConversation {
  return {
    id: row.id,
    clientId: row.client_id,
    summaryId: row.summary_id,
    kind: row.kind as ConversationKind,
    entityId: row.entity_id,
    userId: row.user_id,
    title: row.title,
    modelPreference: row.model_preference as ModelPreference,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export function toMessage(row: MessageRow): AiMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as MessageRole,
    content: row.content,
    provider: row.provider ? (row.provider as LlmProviderName) : null,
    model: row.model,
    tokensInput: row.tokens_input,
    tokensOutput: row.tokens_output,
    createdAt: new Date(row.created_at)
  };
}
