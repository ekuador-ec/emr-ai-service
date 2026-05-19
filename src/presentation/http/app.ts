import express, { type Express, type RequestHandler } from "express";
import cors from "cors";
import type { SummariesController } from "./controllers/summaries.controller.js";
import type { ConversationsController } from "./controllers/conversations.controller.js";
import { healthHandler } from "./controllers/health.controller.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { buildSummariesRouter } from "./routes/summaries.routes.js";
import { buildConversationsRouter } from "./routes/conversations.routes.js";

export interface BuildAppDeps {
  summariesController: SummariesController;
  conversationsController: ConversationsController;
  authMiddleware: RequestHandler;
  rateLimiter?: RequestHandler;
  trustProxy?: boolean | number;
  corsAllowedOrigins?: string[];
}

export function buildApp(deps: BuildAppDeps): Express {
  const app = express();

  if (deps.trustProxy !== undefined) app.set("trust proxy", deps.trustProxy);
  app.disable("x-powered-by");

  if (deps.corsAllowedOrigins && deps.corsAllowedOrigins.length > 0) {
    const allowed = new Set(deps.corsAllowedOrigins);
    const allowAll = allowed.has("*");
    app.use(
      cors({
        origin: (origin, cb) => {
          if (!origin) return cb(null, true);
          if (allowAll || allowed.has(origin)) return cb(null, true);
          return cb(new Error(`Origin ${origin} not allowed by CORS`));
        },
        credentials: false,
        allowedHeaders: ["Content-Type", "Authorization", "X-Api-Key", "X-Request-Id"],
        exposedHeaders: ["X-Request-Id"],
        methods: ["GET", "POST", "DELETE", "OPTIONS"],
        maxAge: 600,
      }),
    );
  }

  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  app.get("/health", healthHandler);

  if (deps.rateLimiter) app.use("/v1", deps.rateLimiter);

  app.use("/v1/summaries", buildSummariesRouter(deps.summariesController, deps.authMiddleware));
  app.use(
    "/v1/conversations",
    buildConversationsRouter(deps.conversationsController, deps.authMiddleware)
  );

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  app.use(errorHandler);

  return app;
}
