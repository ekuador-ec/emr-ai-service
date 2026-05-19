import type { AiConversation, ConversationKind } from "../../../domain/models/Conversation.js";
import type { ConversationRepository } from "../../../domain/repositories/ConversationRepository.js";
import type { SummaryRepository } from "../../../domain/repositories/SummaryRepository.js";
import type { ModelPreference } from "../../../domain/models/Summary.js";
import { DomainError, NotFoundError } from "../../../shared/errors.js";

export interface StartConversationInput {
  clientId: string;
  userId: string;
  summaryId: string | null;
  kind: ConversationKind;
  entityId: string | null;
  title: string | null;
  modelPreference: ModelPreference;
}

export interface StartConversationOutput {
  conversation: AiConversation;
}

export class StartConversationUseCase {
  private readonly conversations: ConversationRepository;
  private readonly summaries: SummaryRepository;

  constructor(deps: { conversations: ConversationRepository; summaries: SummaryRepository }) {
    this.conversations = deps.conversations;
    this.summaries = deps.summaries;
  }

  async execute(input: StartConversationInput): Promise<StartConversationOutput> {
    const isGeneral = input.kind === "general";

    if (isGeneral && input.entityId) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "General conversations must not include an entityId",
      );
    }
    if (!isGeneral && !input.entityId) {
      throw new DomainError(
        "VALIDATION_ERROR",
        `Conversations of kind '${input.kind}' require an entityId`,
      );
    }

    let summaryId: string | null = input.summaryId;

    if (summaryId) {
      if (isGeneral) {
        throw new DomainError(
          "VALIDATION_ERROR",
          "General conversations cannot reference a summaryId",
        );
      }
      const exists = await this.summaries.findById(input.clientId, summaryId);
      if (!exists) {
        throw new NotFoundError("Summary not found for the provided clientId");
      }
      if (exists.kind !== input.kind || exists.entityId !== input.entityId) {
        throw new NotFoundError("Summary does not match the requested entity");
      }
    } else if (!isGeneral && input.entityId) {
      const latest = await this.summaries.findLatest({
        clientId: input.clientId,
        kind: input.kind as Exclude<ConversationKind, "general">,
        entityId: input.entityId,
      });
      summaryId = latest?.id ?? null;
    }

    const conversation = await this.conversations.create({
      clientId: input.clientId,
      userId: input.userId,
      summaryId,
      kind: input.kind,
      entityId: input.entityId,
      title: input.title,
      modelPreference: input.modelPreference,
    });

    return { conversation };
  }
}
