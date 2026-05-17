import type {
  AiSummary,
  LlmProviderName,
  SummaryKind
} from "../../../domain/models/Summary.js";

export interface SummaryRow {
  id: string;
  client_id: string;
  kind: string;
  entity_id: string;
  payload_hash: string;
  prompt_version: string;
  provider: string;
  model: string;
  content: string;
  tokens_input: number | null;
  tokens_output: number | null;
  created_by: string;
  created_at: string;
}

export function toSummary(row: SummaryRow): AiSummary {
  return {
    id: row.id,
    clientId: row.client_id,
    kind: row.kind as SummaryKind,
    entityId: row.entity_id,
    payloadHash: row.payload_hash,
    promptVersion: row.prompt_version,
    provider: row.provider as LlmProviderName,
    model: row.model,
    content: row.content,
    tokensInput: row.tokens_input,
    tokensOutput: row.tokens_output,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at)
  };
}
