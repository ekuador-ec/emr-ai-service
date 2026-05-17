import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedContext } from "../../../domain/services/Auth.js";
import type { ApiKeyValidator, JwtValidator } from "../../../domain/services/Auth.js";
import { AuthError } from "../../../shared/errors.js";

export interface RequestWithAuth extends Request {
  auth?: AuthenticatedContext;
}

export interface AuthMiddlewareDeps {
  apiKeyValidator: ApiKeyValidator;
  jwtValidator: JwtValidator;
}

export function buildAuthMiddleware(deps: AuthMiddlewareDeps) {
  return async function authenticate(
    req: RequestWithAuth,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const rawApiKey = req.header("x-api-key");
      if (!rawApiKey) {
        throw new AuthError("AUTH_MISSING_API_KEY", "Missing X-Api-Key header");
      }

      const authz = req.header("authorization");
      if (!authz || !authz.toLowerCase().startsWith("bearer ")) {
        throw new AuthError("AUTH_MISSING_JWT", "Missing Bearer token");
      }
      const token = authz.slice(7).trim();
      if (!token) {
        throw new AuthError("AUTH_MISSING_JWT", "Missing Bearer token");
      }

      const { client } = await deps.apiKeyValidator.validate(rawApiKey);

      let claims;
      try {
        claims = await deps.jwtValidator.validate(token, client);
      } catch (jwtError) {
        if (jwtError instanceof AuthError) throw jwtError;
        throw new AuthError(
          "AUTH_INVALID_JWT",
          jwtError instanceof Error ? jwtError.message : "Invalid JWT"
        );
      }

      req.auth = {
        client,
        userId: claims.sub,
        userRole: claims.role ?? null
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAuth(req: RequestWithAuth): AuthenticatedContext {
  if (!req.auth) {
    throw new AuthError("AUTH_MISSING_JWT", "Request is not authenticated");
  }
  return req.auth;
}
