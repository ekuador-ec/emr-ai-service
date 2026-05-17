import argon2 from "argon2";
import type { ApiClient } from "../../domain/models/ApiClient.js";
import type { ApiClientRepository } from "../../domain/repositories/ApiClientRepository.js";
import type {
  ApiKeyValidationResult,
  ApiKeyValidator
} from "../../domain/services/Auth.js";
import { AuthError } from "../../shared/errors.js";

const KEY_FORMAT = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/;

export class ArgonApiKeyValidator implements ApiKeyValidator {
  private readonly clients: ApiClientRepository;
  private readonly cache: Map<string, { client: ApiClient; expiresAt: number }>;
  private readonly cacheTtlMs: number;

  constructor(deps: { clients: ApiClientRepository; cacheTtlMs?: number }) {
    this.clients = deps.clients;
    this.cache = new Map();
    this.cacheTtlMs = deps.cacheTtlMs ?? 60_000;
  }

  async validate(rawApiKey: string): Promise<ApiKeyValidationResult> {
    const match = KEY_FORMAT.exec(rawApiKey ?? "");
    if (!match) {
      throw new AuthError("AUTH_INVALID_API_KEY", "API key format is invalid");
    }
    const prefix = match[1]!;
    const secret = match[2]!;

    const cached = this.readCache(prefix, rawApiKey);
    if (cached) return { client: cached };

    const client = await this.clients.findActiveByPrefix(prefix);
    if (!client) {
      throw new AuthError("AUTH_INVALID_API_KEY", "API key is not recognized");
    }

    let ok = false;
    try {
      ok = await argon2.verify(client.apiKeyHash, secret);
    } catch {
      ok = false;
    }
    if (!ok) {
      throw new AuthError("AUTH_INVALID_API_KEY", "API key is not recognized");
    }

    this.writeCache(prefix, rawApiKey, client);
    return { client };
  }

  private cacheKey(prefix: string, rawApiKey: string): string {
    return `${prefix}:${rawApiKey}`;
  }

  private readCache(prefix: string, rawApiKey: string): ApiClient | null {
    const entry = this.cache.get(this.cacheKey(prefix, rawApiKey));
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(this.cacheKey(prefix, rawApiKey));
      return null;
    }
    return entry.client;
  }

  private writeCache(prefix: string, rawApiKey: string, client: ApiClient): void {
    this.cache.set(this.cacheKey(prefix, rawApiKey), {
      client,
      expiresAt: Date.now() + this.cacheTtlMs
    });
  }
}
