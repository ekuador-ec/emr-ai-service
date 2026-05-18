import OpenAI from "openai";
import { APIError } from "openai";
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
import { logger } from "../../shared/logger.js";

export interface OpenRouterProviderConfig {
  apiKey: string;
  baseUrl: string;
  autoModels: string[];
  siteUrl?: string;
  siteName?: string;
  defaultMaxTokens?: number;
}

const RETRYABLE_STATUS_CODES = new Set([404, 408, 429, 500, 502, 503, 504]);
const NO_CONTENT_MARKER = "OpenRouter returned no content";

function isRetryable(err: unknown): boolean {
  if (err instanceof APIError) {
    if (err.status !== undefined && RETRYABLE_STATUS_CODES.has(err.status)) return true;
  }
  if (err instanceof LlmProviderError && err.message === NO_CONTENT_MARKER) return true;
  return false;
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

  private buildRotationOrder(explicitModel: string | undefined): string[] {
    if (explicitModel) return [explicitModel];
    const start = Math.floor(Math.random() * this.autoModels.length);
    const ordered: string[] = [];
    for (let i = 0; i < this.autoModels.length; i++) {
      const idx = (start + i) % this.autoModels.length;
      const candidate = this.autoModels[idx];
      if (candidate) ordered.push(candidate);
    }
    return ordered;
  }

  async complete(
    messages: LlmChatMessage[],
    options: LlmCompletionOptions = {}
  ): Promise<LlmCompletionResult> {
    const candidates = this.buildRotationOrder(options.model);
    let lastError: unknown = null;

    for (let attempt = 0; attempt < candidates.length; attempt++) {
      const model = candidates[attempt]!;
      try {
        const response = await this.client.chat.completions.create({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? this.defaultMaxTokens
        });

        const choice = response.choices[0];
        if (!choice?.message?.content) {
          throw new LlmProviderError(NO_CONTENT_MARKER, { model });
        }

        return {
          content: choice.message.content,
          model: response.model ?? model,
          provider: this.name,
          tokensInput: response.usage?.prompt_tokens ?? null,
          tokensOutput: response.usage?.completion_tokens ?? null
        };
      } catch (err) {
        lastError = err;
        if (!isRetryable(err) || attempt === candidates.length - 1) break;
        logger.warn(
          {
            model,
            nextModel: candidates[attempt + 1],
            reason: err instanceof Error ? err.message.slice(0, 200) : String(err)
          },
          "OpenRouter complete() failed, rotating to next free model"
        );
      }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new LlmProviderError(message, { triedModels: candidates });
  }

  async stream(
    messages: LlmChatMessage[],
    onChunk: (chunk: LlmStreamChunk) => void,
    options: LlmCompletionOptions = {}
  ): Promise<LlmStreamResult> {
    const candidates = this.buildRotationOrder(options.model);
    let lastError: unknown = null;

    for (let attempt = 0; attempt < candidates.length; attempt++) {
      const model = candidates[attempt]!;
      try {
        return await this.runStreamingAttempt(messages, onChunk, options, model);
      } catch (err) {
        lastError = err;
        if (!isRetryable(err) || attempt === candidates.length - 1) break;
        logger.warn(
          {
            model,
            nextModel: candidates[attempt + 1],
            reason: err instanceof Error ? err.message.slice(0, 200) : String(err)
          },
          "OpenRouter stream() failed, rotating to next free model"
        );
      }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new LlmProviderError(message, { triedModels: candidates });
  }

  private async runStreamingAttempt(
    messages: LlmChatMessage[],
    onChunk: (chunk: LlmStreamChunk) => void,
    options: LlmCompletionOptions,
    model: string
  ): Promise<LlmStreamResult> {
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

    if (!fullContent.trim()) {
      throw new LlmProviderError(NO_CONTENT_MARKER, { model: resolvedModel });
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
