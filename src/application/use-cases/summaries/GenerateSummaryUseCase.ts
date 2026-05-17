import type { ModelPreference, SummaryKind } from "../../../domain/models/Summary.js";
import type { AiSummary } from "../../../domain/models/Summary.js";
import type { SummaryRepository } from "../../../domain/repositories/SummaryRepository.js";
import type { LlmRouter } from "../../../domain/services/LlmProvider.js";
import type { Sanitizer } from "../../../domain/services/Sanitizer.js";
import type { PayloadHasher } from "../../services/PayloadHasher.js";
import type { PromptBuilder } from "../../services/PromptBuilder.js";
import { LlmProviderError } from "../../../shared/errors.js";

export interface GenerateSummaryInput {
  clientId: string;
  userId: string;
  kind: SummaryKind;
  entityId: string;
  payload: unknown;
  preference: ModelPreference;
  forceRefresh?: boolean;
}

export interface GenerateSummaryOutput {
  summary: AiSummary;
  cached: boolean;
  sanitizationFindings: number;
}

export class GenerateSummaryUseCase {
  private readonly summaries: SummaryRepository;
  private readonly llmRouter: LlmRouter;
  private readonly sanitizer: Sanitizer;
  private readonly hasher: PayloadHasher;
  private readonly prompts: PromptBuilder;

  constructor(deps: {
    summaries: SummaryRepository;
    llmRouter: LlmRouter;
    sanitizer: Sanitizer;
    hasher: PayloadHasher;
    prompts: PromptBuilder;
  }) {
    this.summaries = deps.summaries;
    this.llmRouter = deps.llmRouter;
    this.sanitizer = deps.sanitizer;
    this.hasher = deps.hasher;
    this.prompts = deps.prompts;
  }

  async execute(input: GenerateSummaryInput): Promise<GenerateSummaryOutput> {
    const { sanitized, findings } = this.sanitizer.sanitize(input.payload);
    const template = this.prompts.getTemplate(input.kind);
    const payloadHash = this.hasher.hash(sanitized, template.version);

    if (!input.forceRefresh) {
      const cached = await this.summaries.findCached({
        clientId: input.clientId,
        kind: input.kind,
        entityId: input.entityId,
        payloadHash
      });
      if (cached) {
        return { summary: cached, cached: true, sanitizationFindings: findings.length };
      }
    }

    const provider = this.llmRouter.pick(input.preference);
    const messages = this.prompts.buildSummaryMessages(input.kind, sanitized);

    let completion;
    try {
      completion = await provider.complete(messages, { temperature: 0.2 });
    } catch (error) {
      throw new LlmProviderError(
        error instanceof Error ? error.message : "LLM provider failed",
        { providerName: provider.name }
      );
    }

    const summary = await this.summaries.create({
      clientId: input.clientId,
      kind: input.kind,
      entityId: input.entityId,
      payloadHash,
      promptVersion: template.version,
      provider: completion.provider,
      model: completion.model,
      content: completion.content,
      tokensInput: completion.tokensInput,
      tokensOutput: completion.tokensOutput,
      createdBy: input.userId
    });

    return { summary, cached: false, sanitizationFindings: findings.length };
  }
}
