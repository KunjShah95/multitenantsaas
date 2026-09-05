/**
 * Minimal Postgres error mapping — no generic framework.
 * Maps pg codes to ApiError for typed handling.
 */
import { ApiError } from "./errors.js";

export function isPgError(err: unknown, code?: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (code ? (err as { code: string }).code === code : true)
  );
}

export function mapPgError(err: unknown): ApiError | null {
  if (!isPgError(err)) return null;
  const pg = err as { code: string; message: string; constraint?: string; detail?: string };

  // Unique violation
  if (pg.code === "23505") {
    return new ApiError(409, "CONFLICT", "Duplicate entry", {
      constraint: pg.constraint,
      detail: pg.detail,
    });
  }
  // Foreign key violation
  if (pg.code === "23503") {
    return new ApiError(422, "UNPROCESSABLE", "Referenced record does not exist", {
      constraint: pg.constraint,
    });
  }
  // Check violation
  if (pg.code === "23514") {
    return new ApiError(422, "UNPROCESSABLE", "Check constraint violated", {
      constraint: pg.constraint,
    });
  }
  // Not null violation
  if (pg.code === "23502") {
    return new ApiError(400, "BAD_REQUEST", "Missing required field", {
      detail: pg.detail,
    });
  }
  return null;
}
