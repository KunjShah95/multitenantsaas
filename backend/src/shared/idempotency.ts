import { eq, and } from "drizzle-orm";
import type { Db } from "../db/connection.js";
import { idempotencyKeys } from "../db/schema/index.js";

export type IdempotencyLookup = {
  tenantId: string;
  actorId: string;
  operation: string;
  key: string;
};

export async function findIdempotency(
  tx: Db,
  input: IdempotencyLookup,
): Promise<typeof idempotencyKeys.$inferSelect | undefined> {
  const rows = await tx
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.tenantId, input.tenantId),
        eq(idempotencyKeys.actorId, input.actorId),
        eq(idempotencyKeys.operation, input.operation),
        eq(idempotencyKeys.key, input.key),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function storeIdempotency(
  tx: Db,
  input: IdempotencyLookup & {
    requestHash?: string | null;
    responseStatus?: string | null;
    responseBody?: unknown;
    expiresAt?: Date | null;
  },
): Promise<void> {
  await tx.insert(idempotencyKeys).values({
    tenantId: input.tenantId,
    actorId: input.actorId,
    operation: input.operation,
    key: input.key,
    requestHash: input.requestHash ?? null,
    responseStatus: input.responseStatus ?? null,
    responseBody: (input.responseBody as Record<string, unknown>) ?? null,
    expiresAt: input.expiresAt ?? null,
  });
}
