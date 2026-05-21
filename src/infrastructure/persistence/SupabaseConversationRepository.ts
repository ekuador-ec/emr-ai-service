import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AiConversation,
  AiMessage,
  CreateConversationInput,
  CreateMessageInput
} from "../../domain/models/Conversation.js";
import type {
  ConversationRepository,
  ListConversationsQuery,
  ListMessagesQuery,
  UpdatePreferenceInput
} from "../../domain/repositories/ConversationRepository.js";
import { PersistenceError } from "../../shared/errors.js";
import {
  toConversation,
  toMessage,
  type ConversationRow,
  type MessageRow
} from "./mappers/conversationMapper.js";

const CONV_TABLE = "ai_conversations";
const MSG_TABLE = "ai_messages";

const CONV_COLUMNS =
  "id, client_id, summary_id, kind, entity_id, user_id, title, model_preference, created_at, updated_at";
const MSG_COLUMNS =
  "id, conversation_id, role, content, provider, model, tokens_input, tokens_output, created_at";

export class SupabaseConversationRepository implements ConversationRepository {
  private readonly db: SupabaseClient;

  constructor(deps: { db: SupabaseClient }) {
    this.db = deps.db;
  }

  async create(input: CreateConversationInput): Promise<AiConversation> {
    const { data, error } = await this.db
      .from(CONV_TABLE)
      .insert({
        client_id: input.clientId,
        summary_id: input.summaryId,
        kind: input.kind,
        entity_id: input.entityId,
        user_id: input.userId,
        title: input.title,
        model_preference: input.modelPreference
      })
      .select(CONV_COLUMNS)
      .single();

    if (error || !data) {
      throw new PersistenceError(`create conversation failed: ${error?.message ?? "no data"}`);
    }
    return toConversation(data as ConversationRow);
  }

  async findById(clientId: string, conversationId: string): Promise<AiConversation | null> {
    const { data, error } = await this.db
      .from(CONV_TABLE)
      .select(CONV_COLUMNS)
      .eq("client_id", clientId)
      .eq("id", conversationId)
      .maybeSingle();

    if (error) throw new PersistenceError(`findById conversation failed: ${error.message}`);
    return data ? toConversation(data as ConversationRow) : null;
  }

  async listForUser(query: ListConversationsQuery): Promise<AiConversation[]> {
    const { data, error } = await this.db
      .from(CONV_TABLE)
      .select(CONV_COLUMNS)
      .eq("client_id", query.clientId)
      .eq("user_id", query.userId)
      .order("updated_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (error) throw new PersistenceError(`listForUser failed: ${error.message}`);
    return (data ?? []).map((row) => toConversation(row as ConversationRow));
  }

  async delete(clientId: string, conversationId: string): Promise<void> {
    const { error } = await this.db
      .from(CONV_TABLE)
      .delete()
      .eq("client_id", clientId)
      .eq("id", conversationId);

    if (error) throw new PersistenceError(`delete conversation failed: ${error.message}`);
  }

  async updatePreference(input: UpdatePreferenceInput): Promise<AiConversation> {
    const { data, error } = await this.db
      .from(CONV_TABLE)
      .update({ model_preference: input.modelPreference })
      .eq("client_id", input.clientId)
      .eq("id", input.conversationId)
      .select(CONV_COLUMNS)
      .single();

    if (error || !data) {
      throw new PersistenceError(`updatePreference failed: ${error?.message ?? "no data"}`);
    }
    return toConversation(data as ConversationRow);
  }

  async appendMessage(input: CreateMessageInput): Promise<AiMessage> {
    const { data, error } = await this.db
      .from(MSG_TABLE)
      .insert({
        conversation_id: input.conversationId,
        role: input.role,
        content: input.content,
        provider: input.provider,
        model: input.model,
        tokens_input: input.tokensInput,
        tokens_output: input.tokensOutput
      })
      .select(MSG_COLUMNS)
      .single();

    if (error || !data) {
      throw new PersistenceError(`appendMessage failed: ${error?.message ?? "no data"}`);
    }
    return toMessage(data as MessageRow);
  }

  async listMessages(query: ListMessagesQuery): Promise<AiMessage[]> {
    const { data, error } = await this.db
      .from(MSG_TABLE)
      .select(MSG_COLUMNS)
      .eq("conversation_id", query.conversationId)
      .order("created_at", { ascending: false })
      .limit(query.limit);

    if (error) throw new PersistenceError(`listMessages failed: ${error.message}`);
    return (data ?? [])
      .map((row) => toMessage(row as MessageRow))
      .reverse();
  }
}
