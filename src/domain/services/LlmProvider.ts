import type { LlmProviderName, ModelPreference } from "../models/Summary.js";
import type { MessageRole } from "../models/Conversation.js";

export interface LlmChatMessage {
  role: MessageRole;
  content: string;
}

export interface LlmCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LlmCompletionResult {
  content: string;
  model: string;
  provider: LlmProviderName;
  tokensInput: number | null;
  tokensOutput: number | null;
}

export interface LlmStreamChunk {
  delta: string;
  done: boolean;
}

export interface LlmStreamResult {
  model: string;
  provider: LlmProviderName;
  tokensInput: number | null;
  tokensOutput: number | null;
  fullContent: string;
}

export interface LlmProvider {
  readonly name: LlmProviderName;
  complete(messages: LlmChatMessage[], options?: LlmCompletionOptions): Promise<LlmCompletionResult>;
  stream(
    messages: LlmChatMessage[],
    onChunk: (chunk: LlmStreamChunk) => void,
    options?: LlmCompletionOptions
  ): Promise<LlmStreamResult>;
}

export interface LlmRouter {
  pick(preference: ModelPreference): LlmProvider;
}
