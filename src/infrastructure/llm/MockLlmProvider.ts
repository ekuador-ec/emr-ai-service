import type {
  LlmChatMessage,
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmProvider,
  LlmStreamChunk,
  LlmStreamResult
} from "../../domain/services/LlmProvider.js";
import type { LlmProviderName } from "../../domain/models/Summary.js";

export interface MockResponderInput {
  messages: LlmChatMessage[];
  options: LlmCompletionOptions;
}

export type MockResponder = (input: MockResponderInput) => string;

export class MockLlmProvider implements LlmProvider {
  readonly name: LlmProviderName = "mock";
  private readonly responder: MockResponder;
  private readonly model: string;

  constructor(opts?: { responder?: MockResponder; model?: string }) {
    this.responder = opts?.responder ?? (() => "Resumen clinico simulado (mock).");
    this.model = opts?.model ?? "mock-1";
  }

  async complete(messages: LlmChatMessage[], options: LlmCompletionOptions = {}): Promise<LlmCompletionResult> {
    const content = this.responder({ messages, options });
    return {
      content,
      model: options.model ?? this.model,
      provider: this.name,
      tokensInput: this.estimateTokens(messages.map((m) => m.content).join("\n")),
      tokensOutput: this.estimateTokens(content)
    };
  }

  async stream(
    messages: LlmChatMessage[],
    onChunk: (chunk: LlmStreamChunk) => void,
    options: LlmCompletionOptions = {}
  ): Promise<LlmStreamResult> {
    const content = this.responder({ messages, options });
    const words = content.split(/(\s+)/);
    for (const word of words) {
      onChunk({ delta: word, done: false });
    }
    onChunk({ delta: "", done: true });
    return {
      provider: this.name,
      model: options.model ?? this.model,
      fullContent: content,
      tokensInput: this.estimateTokens(messages.map((m) => m.content).join("\n")),
      tokensOutput: this.estimateTokens(content)
    };
  }

  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }
}
