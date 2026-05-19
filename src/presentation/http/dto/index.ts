import type { AiSummary } from "../../../domain/models/Summary.js";
import type { AiConversation, AiMessage } from "../../../domain/models/Conversation.js";

export interface SummaryDto {
  id: string;
  kind: string;
  entityId: string;
  promptVersion: string;
  provider: string;
  model: string;
  content: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  createdBy: string;
  createdAt: string;
}

export interface ConversationDto {
  id: string;
  summaryId: string | null;
  kind: string;
  entityId: string | null;
  userId: string;
  title: string | null;
  modelPreference: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  provider: string | null;
  model: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  createdAt: string;
}

export function summaryDto(s: AiSummary): SummaryDto {
  return {
    id: s.id,
    kind: s.kind,
    entityId: s.entityId,
    promptVersion: s.promptVersion,
    provider: s.provider,
    model: s.model,
    content: s.content,
    tokensInput: s.tokensInput,
    tokensOutput: s.tokensOutput,
    createdBy: s.createdBy,
    createdAt: s.createdAt.toISOString()
  };
}

export function conversationDto(c: AiConversation): ConversationDto {
  return {
    id: c.id,
    summaryId: c.summaryId,
    kind: c.kind,
    entityId: c.entityId,
    userId: c.userId,
    title: c.title,
    modelPreference: c.modelPreference,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString()
  };
}

export function messageDto(m: AiMessage): MessageDto {
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role,
    content: m.content,
    provider: m.provider,
    model: m.model,
    tokensInput: m.tokensInput,
    tokensOutput: m.tokensOutput,
    createdAt: m.createdAt.toISOString()
  };
}
