export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_MISSING_API_KEY"
  | "AUTH_INVALID_API_KEY"
  | "AUTH_MISSING_JWT"
  | "AUTH_INVALID_JWT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "LLM_PROVIDER_ERROR"
  | "PERSISTENCE_ERROR"
  | "SANITIZATION_FAILED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class DomainError extends AppError {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(code, message, 400, details);
    this.name = "DomainError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: unknown) {
    super("NOT_FOUND", message, 404, details);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super("CONFLICT", message, 409, details);
    this.name = "ConflictError";
  }
}

export class AuthError extends AppError {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(code, message, 401, details);
    this.name = "AuthError";
  }
}

export class LlmProviderError extends AppError {
  constructor(message: string, details?: unknown) {
    super("LLM_PROVIDER_ERROR", message, 502, details);
    this.name = "LlmProviderError";
  }
}

export class PersistenceError extends AppError {
  constructor(message: string, details?: unknown) {
    super("PERSISTENCE_ERROR", message, 500, details);
    this.name = "PersistenceError";
  }
}
