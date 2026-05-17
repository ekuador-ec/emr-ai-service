import { randomUUID } from "node:crypto";
import type {
  AiSummary,
  CreateSummaryInput
} from "../../src/domain/models/Summary.js";
import type {
  FindCachedSummaryQuery,
  FindLatestSummaryQuery,
  SummaryRepository
} from "../../src/domain/repositories/SummaryRepository.js";

export class InMemorySummaryRepository implements SummaryRepository {
  private readonly items: AiSummary[] = [];

  async findCached(query: FindCachedSummaryQuery): Promise<AiSummary | null> {
    return (
      this.items.find(
        (s) =>
          s.clientId === query.clientId &&
          s.kind === query.kind &&
          s.entityId === query.entityId &&
          s.payloadHash === query.payloadHash
      ) ?? null
    );
  }

  async findLatest(query: FindLatestSummaryQuery): Promise<AiSummary | null> {
    const matches = this.items
      .filter((s) => s.clientId === query.clientId && s.kind === query.kind && s.entityId === query.entityId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return matches[0] ?? null;
  }

  async findById(clientId: string, summaryId: string): Promise<AiSummary | null> {
    return this.items.find((s) => s.id === summaryId && s.clientId === clientId) ?? null;
  }

  async create(input: CreateSummaryInput): Promise<AiSummary> {
    const summary: AiSummary = {
      id: randomUUID(),
      clientId: input.clientId,
      kind: input.kind,
      entityId: input.entityId,
      payloadHash: input.payloadHash,
      promptVersion: input.promptVersion,
      provider: input.provider,
      model: input.model,
      content: input.content,
      tokensInput: input.tokensInput,
      tokensOutput: input.tokensOutput,
      createdBy: input.createdBy,
      createdAt: new Date()
    };
    this.items.push(summary);
    return summary;
  }

  snapshot(): AiSummary[] {
    return [...this.items];
  }
}
