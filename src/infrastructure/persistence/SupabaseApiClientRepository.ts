import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiClient } from "../../domain/models/ApiClient.js";
import type { ApiClientRepository } from "../../domain/repositories/ApiClientRepository.js";
import { PersistenceError } from "../../shared/errors.js";
import { toApiClient, type ApiClientRow } from "./mappers/apiClientMapper.js";

const TABLE = "api_clients";
const SELECT_COLUMNS =
  "id, name, api_key_prefix, api_key_hash, jwks_url, audience, is_active, created_at, updated_at";

export class SupabaseApiClientRepository implements ApiClientRepository {
  private readonly db: SupabaseClient;

  constructor(deps: { db: SupabaseClient }) {
    this.db = deps.db;
  }

  async findActiveById(id: string): Promise<ApiClient | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select(SELECT_COLUMNS)
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw new PersistenceError(`findActiveById failed: ${error.message}`);
    return data ? toApiClient(data as ApiClientRow) : null;
  }

  async findActiveByPrefix(prefix: string): Promise<ApiClient | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select(SELECT_COLUMNS)
      .eq("api_key_prefix", prefix)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw new PersistenceError(`findActiveByPrefix failed: ${error.message}`);
    return data ? toApiClient(data as ApiClientRow) : null;
  }
}
