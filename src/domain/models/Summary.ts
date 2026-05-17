export type SummaryKind = "medical_record" | "evolution";

export type LlmProviderName = "deepseek" | "openrouter" | "mock";

export type ModelPreference = "deepseek" | "auto";

export interface AiSummary {
  id: string;
  clientId: string;
  kind: SummaryKind;
  entityId: string;
  payloadHash: string;
  promptVersion: string;
  provider: LlmProviderName;
  model: string;
  content: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  createdBy: string;
  createdAt: Date;
}

export interface CreateSummaryInput {
  clientId: string;
  kind: SummaryKind;
  entityId: string;
  payloadHash: string;
  promptVersion: string;
  provider: LlmProviderName;
  model: string;
  content: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  createdBy: string;
}
