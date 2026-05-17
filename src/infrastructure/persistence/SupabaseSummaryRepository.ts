import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AiSummary,
  CreateSummaryInput
} from "../../domain/models/Summary.js";
import type {
  FindCachedSummaryQuery,
  FindLatestSummaryQuery,
  SummaryRepository
} from "../../domain/repositories/SummaryRepository.js";
import { PersistenceError } from "../../shared/errors.js";
import { toSummary, type SummaryRow } from "./mappers/summaryMapper.js";

const TABLE = "ai_summaries";
const SELECT_COLUMNS =
  "id, client_id, kind, entity_id, payload_hash, prompt_version, provider, model, content, tokens_input, tokens_output, created_by, created_at";

export class SupabaseSummaryRepository implements SummaryRepository {
  private readonly db: SupabaseClient;

  constructor(deps: { db: SupabaseClient }) {
    this.db = deps.db;
  }

  async findCached(query: FindCachedSummaryQuery): Promise<AiSummary | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select(SELECT_COLUMNS)
      .eq("client_id", query.clientId)
      .eq("kind", query.kind)
      .eq("entity_id", query.entityId)
      .eq("payload_hash", query.payloadHash)
      .maybeSingle();

    if (error) throw new PersistenceError(`findCached failed: ${error.message}`);
    return data ? toSummary(data as SummaryRow) : null;
  }

  async findLatest(query: FindLatestSummaryQuery): Promise<AiSummary | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select(SELECT_COLUMNS)
      .eq("client_id", query.clientId)
      .eq("kind", query.kind)
      .eq("entity_id", query.entityId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new PersistenceError(`findLatest failed: ${error.message}`);
    return data ? toSummary(data as SummaryRow) : null;
  }

  async findById(clientId: string, summaryId: string): Promise<AiSummary | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select(SELECT_COLUMNS)
      .eq("client_id", clientId)
      .eq("id", summaryId)
      .maybeSingle();

    if (error) throw new PersistenceError(`findById failed: ${error.message}`);
    return data ? toSummary(data as SummaryRow) : null;
  }

  async create(input: CreateSummaryInput): Promise<AiSummary> {
    const { data, error } = await this.db
      .from(TABLE)
      .insert({
        client_id: input.clientId,
        kind: input.kind,
        entity_id: input.entityId,
        payload_hash: input.payloadHash,
        prompt_version: input.promptVersion,
        provider: input.provider,
        model: input.model,
        content: input.content,
        tokens_input: input.tokensInput,
        tokens_output: input.tokensOutput,
        created_by: input.createdBy
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error || !data) throw new PersistenceError(`create summary failed: ${error?.message ?? "no data"}`);
    return toSummary(data as SummaryRow);
  }
}
