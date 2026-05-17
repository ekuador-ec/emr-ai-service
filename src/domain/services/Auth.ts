import type { ApiClient } from "../models/ApiClient.js";

export interface ApiKeyValidationResult {
  client: ApiClient;
}

export interface ApiKeyValidator {
  validate(rawApiKey: string): Promise<ApiKeyValidationResult>;
}

export interface JwtClaims {
  sub: string;
  role?: string;
  email?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  iat?: number;
}

export interface JwtValidator {
  validate(rawToken: string, client: ApiClient): Promise<JwtClaims>;
}

export interface AuthenticatedContext {
  client: ApiClient;
  userId: string;
  userRole: string | null;
}
