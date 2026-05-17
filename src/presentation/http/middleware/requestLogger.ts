import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { logger } from "../../../shared/logger.js";

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestLogger(req: RequestWithId, res: Response, next: NextFunction): void {
  const requestId = req.header("x-request-id") ?? randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs
      },
      "request"
    );
  });
  next();
}
