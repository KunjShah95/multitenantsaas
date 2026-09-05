import type { Request, Response, NextFunction } from "express";

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VERSION_CONFLICT"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "DEPENDENCY_ERROR"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorEnvelope(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: unknown,
) {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      requestId,
    },
  };
}

export function notFoundHandler(req: Request, res: Response) {
  const requestId = (req as unknown as { requestId: string }).requestId ?? "req_unknown";
  res
    .status(404)
    .json(errorEnvelope("NOT_FOUND", `Route ${req.method} ${req.path} not found`, requestId));
}

// Single error envelope middleware — per docs/03-backend-architecture.md
export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as unknown as { requestId: string }).requestId ?? "req_unknown";

  if (err instanceof ApiError) {
    res.status(err.status).json(errorEnvelope(err.code, err.message, requestId, err.details));
    return;
  }

  // Zod validation or other known 400s could be mapped here in later phases
  if (err instanceof SyntaxError && "status" in (err as unknown as Record<string, unknown>)) {
    res.status(400).json(errorEnvelope("BAD_REQUEST", "Malformed JSON", requestId));
    return;
  }

  // Unexpected — log with requestId, never leak internals
  // eslint-disable-next-line no-console
  console.error(`[${requestId}] unexpected error`, err);
  res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Internal server error", requestId));
}
