import type { AiSummary, SummaryKind } from "../../../domain/models/Summary.js";
import type { SummaryRepository } from "../../../domain/repositories/SummaryRepository.js";

export interface GetLatestSummaryInput {
  clientId: string;
  kind: SummaryKind;
  entityId: string;
}

export class GetLatestSummaryUseCase {
  private readonly summaries: SummaryRepository;

  constructor(deps: { summaries: SummaryRepository }) {
    this.summaries = deps.summaries;
  }

  async execute(input: GetLatestSummaryInput): Promise<AiSummary | null> {
    return this.summaries.findLatest({
      clientId: input.clientId,
      kind: input.kind,
      entityId: input.entityId
    });
  }
}
