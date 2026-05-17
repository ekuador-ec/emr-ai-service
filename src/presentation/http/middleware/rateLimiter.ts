import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";

export function buildRateLimiter(perMinute: number): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: perMinute,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => {
      const apiKey = req.header("x-api-key") ?? "";
      const prefix = apiKey.split(".")[0] ?? "anon";
      return `${prefix}:${req.ip ?? "no-ip"}`;
    },
    message: {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests, slow down"
      }
    }
  });
}
