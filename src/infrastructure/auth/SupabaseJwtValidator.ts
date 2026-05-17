import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { ApiClient } from "../../domain/models/ApiClient.js";
import type { JwtClaims, JwtValidator } from "../../domain/services/Auth.js";
import { AuthError } from "../../shared/errors.js";

type JwksSet = ReturnType<typeof createRemoteJWKSet>;

export class SupabaseJwtValidator implements JwtValidator {
  private readonly jwksCache: Map<string, JwksSet>;

  constructor() {
    this.jwksCache = new Map();
  }

  async validate(rawToken: string, client: ApiClient): Promise<JwtClaims> {
    if (!rawToken) {
      throw new AuthError("AUTH_MISSING_JWT", "Authorization token is required");
    }
    const jwks = this.getJwks(client.jwksUrl);

    let payload: JWTPayload;
    try {
      const verified = await jwtVerify(rawToken, jwks, {
        audience: client.audience ?? undefined
      });
      payload = verified.payload;
    } catch (error) {
      throw new AuthError(
        "AUTH_INVALID_JWT",
        error instanceof Error ? error.message : "Invalid JWT"
      );
    }

    if (!payload.sub) {
      throw new AuthError("AUTH_INVALID_JWT", "JWT is missing the 'sub' claim");
    }

    const role = (payload as Record<string, unknown>)["user_role"]
      ?? (payload as Record<string, unknown>)["role"];

    return {
      sub: payload.sub,
      role: typeof role === "string" ? role : undefined,
      email: typeof payload["email"] === "string" ? (payload["email"] as string) : undefined,
      aud: payload.aud,
      iss: payload.iss,
      exp: payload.exp,
      iat: payload.iat
    };
  }

  private getJwks(jwksUrl: string): JwksSet {
    let jwks = this.jwksCache.get(jwksUrl);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(jwksUrl), {
        cooldownDuration: 30_000,
        cacheMaxAge: 3_600_000
      });
      this.jwksCache.set(jwksUrl, jwks);
    }
    return jwks;
  }
}
