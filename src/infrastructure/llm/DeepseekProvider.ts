import OpenAI from "openai";
import type {
  LlmChatMessage,
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmProvider,
  LlmStreamChunk,
  LlmStreamResult
} from "../../domain/services/LlmProvider.js";
import type { LlmProviderName } from "../../domain/models/Summary.js";
import { LlmProviderError } from "../../shared/errors.js";

export interface DeepseekProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  defaultMaxTokens?: number;
}

export class DeepseekProvider implements LlmProvider {
  readonly name: LlmProviderName = "deepseek";
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly defaultMaxTokens: number;

  constructor(config: DeepseekProviderConfig) {
    if (!config.apiKey) {
      throw new LlmProviderError("DEEPSEEK_API_KEY is required to use DeepseekProvider");
    }
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    this.model = config.model;
    this.defaultMaxTokens = config.defaultMaxTokens ?? 1500;
  }

  async complete(
    messages: LlmChatMessage[],
    options: LlmCompletionOptions = {}
  ): Promise<LlmCompletionResult> {
    const model = options.model ?? this.model;
    const response = await this.client.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? this.defaultMaxTokens
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new LlmProviderError("DeepSeek returned no content", { model });
    }

    return {
      content: choice.message.content,
      model: response.model ?? model,
      provider: this.name,
      tokensInput: response.usage?.prompt_tokens ?? null,
      tokensOutput: response.usage?.completion_tokens ?? null
    };
  }

  async stream(
    messages: LlmChatMessage[],
    onChunk: (chunk: LlmStreamChunk) => void,
    options: LlmCompletionOptions = {}
  ): Promise<LlmStreamResult> {
    const model = options.model ?? this.model;
    let fullContent = "";
    let tokensInput: number | null = null;
    let tokensOutput: number | null = null;
    let resolvedModel = model;

    const stream = await this.client.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? this.defaultMaxTokens,
      stream: true,
      stream_options: { include_usage: true }
    });

    for await (const event of stream) {
      if (event.model) resolvedModel = event.model;
      const delta = event.choices[0]?.delta?.content ?? "";
      if (delta) {
        fullContent += delta;
        onChunk({ delta, done: false });
      }
      if (event.usage) {
        tokensInput = event.usage.prompt_tokens ?? tokensInput;
        tokensOutput = event.usage.completion_tokens ?? tokensOutput;
      }
    }

    onChunk({ delta: "", done: true });

    return {
      provider: this.name,
      model: resolvedModel,
      fullContent,
      tokensInput,
      tokensOutput
    };
  }
}
