import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";

interface ErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const payload: ErrorPayload = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request payload is invalid",
        details: err.flatten()
      }
    };
    res.status(400).json(payload);
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, "AppError 5xx");
    } else {
      logger.warn({ code: err.code, path: req.path, msg: err.message }, "AppError");
    }
    const payload: ErrorPayload = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    };
    res.status(err.statusCode).json(payload);
    return;
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  const payload: ErrorPayload = {
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error"
    }
  };
  res.status(500).json(payload);
}
