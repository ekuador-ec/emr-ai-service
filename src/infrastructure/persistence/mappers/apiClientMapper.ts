import type { ApiClient } from "../../../domain/models/ApiClient.js";

export interface ApiClientRow {
  id: string;
  name: string;
  api_key_prefix: string;
  api_key_hash: string;
  jwks_url: string;
  audience: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function toApiClient(row: ApiClientRow): ApiClient {
  return {
    id: row.id,
    name: row.name,
    apiKeyPrefix: row.api_key_prefix,
    apiKeyHash: row.api_key_hash,
    jwksUrl: row.jwks_url,
    audience: row.audience,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}
