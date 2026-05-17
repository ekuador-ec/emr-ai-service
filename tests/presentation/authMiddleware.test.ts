import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import argon2 from "argon2";
import { buildAuthMiddleware } from "../../src/presentation/http/middleware/authMiddleware.js";
import { errorHandler } from "../../src/presentation/http/middleware/errorHandler.js";
import { ArgonApiKeyValidator } from "../../src/infrastructure/auth/ArgonApiKeyValidator.js";
import type { ApiClient } from "../../src/domain/models/ApiClient.js";
import type {
  ApiClientRepository
} from "../../src/domain/repositories/ApiClientRepository.js";
import type {
  JwtClaims,
  JwtValidator
} from "../../src/domain/services/Auth.js";
import type { RequestWithAuth } from "../../src/presentation/http/middleware/authMiddleware.js";

class StubApiClientRepo implements ApiClientRepository {
  private readonly clients: ApiClient[];
  constructor(clients: ApiClient[]) {
    this.clients = clients;
  }
  async findActiveById(id: string) {
    return this.clients.find((c) => c.id === id && c.isActive) ?? null;
  }
  async findActiveByPrefix(prefix: string) {
    return this.clients.find((c) => c.apiKeyPrefix === prefix && c.isActive) ?? null;
  }
}

class StubJwtValidator implements JwtValidator {
  private readonly claims: JwtClaims | null;
  private readonly shouldThrow: boolean;
  constructor(claims: JwtClaims | null, shouldThrow = false) {
    this.claims = claims;
    this.shouldThrow = shouldThrow;
  }
  async validate(): Promise<JwtClaims> {
    if (this.shouldThrow) throw new Error("invalid jwt");
    if (!this.claims) throw new Error("no claims");
    return this.claims;
  }
}

async function buildHarnessApp(opts: {
  clients: ApiClient[];
  jwtValidator: JwtValidator;
}) {
  const apiKeyValidator = new ArgonApiKeyValidator({
    clients: new StubApiClientRepo(opts.clients),
    cacheTtlMs: 0
  });
  const authMiddleware = buildAuthMiddleware({
    apiKeyValidator,
    jwtValidator: opts.jwtValidator
  });
  const app = express();
  app.get(
    "/protected",
    authMiddleware,
    (req: RequestWithAuth, res) => {
      res.json({ userId: req.auth?.userId, clientId: req.auth?.client.id });
    }
  );
  app.use(errorHandler);
  return app;
}

describe("authMiddleware", () => {
  it("rechaza con 401 si falta X-Api-Key", async () => {
    const app = await buildHarnessApp({
      clients: [],
      jwtValidator: new StubJwtValidator({ sub: "u" })
    });
    const r = await request(app).get("/protected").set("Authorization", "Bearer xyz");
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("AUTH_MISSING_API_KEY");
  });

  it("rechaza con 401 si falta el bearer token", async () => {
    const app = await buildHarnessApp({
      clients: [],
      jwtValidator: new StubJwtValidator({ sub: "u" })
    });
    const r = await request(app).get("/protected").set("X-Api-Key", "eai_test.secret");
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("AUTH_MISSING_JWT");
  });

  it("rechaza con 401 si la API key no esta registrada", async () => {
    const app = await buildHarnessApp({
      clients: [],
      jwtValidator: new StubJwtValidator({ sub: "u" })
    });
    const r = await request(app)
      .get("/protected")
      .set("X-Api-Key", "eai_test.secret")
      .set("Authorization", "Bearer something");
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("AUTH_INVALID_API_KEY");
  });

  it("rechaza con 401 si el secret no coincide con el hash", async () => {
    const hash = await argon2.hash("correct-secret");
    const client: ApiClient = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "t",
      apiKeyPrefix: "eai_test",
      apiKeyHash: hash,
      jwksUrl: "https://example.invalid",
      audience: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const app = await buildHarnessApp({
      clients: [client],
      jwtValidator: new StubJwtValidator({ sub: "u" })
    });
    const r = await request(app)
      .get("/protected")
      .set("X-Api-Key", "eai_test.wrong-secret")
      .set("Authorization", "Bearer x");
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("AUTH_INVALID_API_KEY");
  });

  it("autoriza cuando API key valida + JWT valido", async () => {
    const hash = await argon2.hash("right-secret");
    const client: ApiClient = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "t",
      apiKeyPrefix: "eai_test",
      apiKeyHash: hash,
      jwksUrl: "https://example.invalid",
      audience: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const jwt = new StubJwtValidator({ sub: "user-1", role: "doctor" });
    const validateSpy = vi.spyOn(jwt, "validate");
    const app = await buildHarnessApp({ clients: [client], jwtValidator: jwt });

    const r = await request(app)
      .get("/protected")
      .set("X-Api-Key", "eai_test.right-secret")
      .set("Authorization", "Bearer good-jwt");

    expect(r.status).toBe(200);
    expect(r.body.userId).toBe("user-1");
    expect(r.body.clientId).toBe(client.id);
    expect(validateSpy).toHaveBeenCalledOnce();
  });

  it("rechaza con 401 cuando el JWT validator falla", async () => {
    const hash = await argon2.hash("right-secret");
    const client: ApiClient = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "t",
      apiKeyPrefix: "eai_test",
      apiKeyHash: hash,
      jwksUrl: "https://example.invalid",
      audience: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const app = await buildHarnessApp({
      clients: [client],
      jwtValidator: new StubJwtValidator(null, true)
    });

    const r = await request(app)
      .get("/protected")
      .set("X-Api-Key", "eai_test.right-secret")
      .set("Authorization", "Bearer something");
    expect(r.status).toBe(401);
  });
});
