import { randomUUID } from "node:crypto";

/**
 * ID generation helpers — centralized so future ULID/KSUID swaps are single-point.
 * Uses crypto.randomUUID() for Postgres uuid columns.
 */
export function newId(): string {
  return randomUUID();
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
