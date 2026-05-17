import type { ModelPreference } from "../../domain/models/Summary.js";
import type { LlmProvider, LlmRouter } from "../../domain/services/LlmProvider.js";

export interface DefaultLlmRouterConfig {
  deepseek: LlmProvider | null;
  openRouter: LlmProvider | null;
  fallback: LlmProvider;
}

export class DefaultLlmRouter implements LlmRouter {
  private readonly deepseek: LlmProvider | null;
  private readonly openRouter: LlmProvider | null;
  private readonly fallback: LlmProvider;

  constructor(config: DefaultLlmRouterConfig) {
    this.deepseek = config.deepseek;
    this.openRouter = config.openRouter;
    this.fallback = config.fallback;
  }

  pick(preference: ModelPreference): LlmProvider {
    if (preference === "deepseek") {
      return this.deepseek ?? this.openRouter ?? this.fallback;
    }
    return this.openRouter ?? this.deepseek ?? this.fallback;
  }
}
