import type { AiSummary, CreateSummaryInput, SummaryKind } from "../models/Summary.js";

export interface FindCachedSummaryQuery {
  clientId: string;
  kind: SummaryKind;
  entityId: string;
  payloadHash: string;
}

export interface FindLatestSummaryQuery {
  clientId: string;
  kind: SummaryKind;
  entityId: string;
}

export interface SummaryRepository {
  findCached(query: FindCachedSummaryQuery): Promise<AiSummary | null>;
  findLatest(query: FindLatestSummaryQuery): Promise<AiSummary | null>;
  findById(clientId: string, summaryId: string): Promise<AiSummary | null>;
  create(input: CreateSummaryInput): Promise<AiSummary>;
}
