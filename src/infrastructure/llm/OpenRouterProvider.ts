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

export interface OpenRouterProviderConfig {
  apiKey: string;
  baseUrl: string;
  autoModels: string[];
  siteUrl?: string;
  siteName?: string;
  defaultMaxTokens?: number;
}

export class OpenRouterProvider implements LlmProvider {
  readonly name: LlmProviderName = "openrouter";
  private readonly client: OpenAI;
  private readonly autoModels: string[];
  private readonly defaultMaxTokens: number;

  constructor(config: OpenRouterProviderConfig) {
    if (!config.apiKey) {
      throw new LlmProviderError("OPENROUTER_API_KEY is required to use OpenRouterProvider");
    }
    if (!config.autoModels.length) {
      throw new LlmProviderError("OPENROUTER_AUTO_MODELS must contain at least one model id");
    }

    const headers: Record<string, string> = {};
    if (config.siteUrl) headers["HTTP-Referer"] = config.siteUrl;
    if (config.siteName) headers["X-Title"] = config.siteName;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      defaultHeaders: headers
    });
    this.autoModels = config.autoModels;
    this.defaultMaxTokens = config.defaultMaxTokens ?? 1500;
  }

  pickAutoModel(): string {
    const index = Math.floor(Math.random() * this.autoModels.length);
    return this.autoModels[index] ?? this.autoModels[0]!;
  }

  async complete(
    messages: LlmChatMessage[],
    options: LlmCompletionOptions = {}
  ): Promise<LlmCompletionResult> {
    const model = options.model ?? this.pickAutoModel();

    const response = await this.client.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? this.defaultMaxTokens
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new LlmProviderError("OpenRouter returned no content", { model });
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
    const model = options.model ?? this.pickAutoModel();
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
