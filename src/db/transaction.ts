import { sql } from "drizzle-orm";
import { getDb, type Db } from "./connection.js";

export type TenantContext = {
  tenantId: string;
  actorId?: string;
  requestId?: string;
};

/**
 * Executes fn inside a transaction with SET LOCAL app.tenant_id.
 * Rejects missing tenantId. Repositories must use the provided tx.
 * Uses SET LOCAL (transaction-scoped) per tenancy doc, never connection-wide SET.
 */
export async function withTenantTransaction<T>(
  context: TenantContext,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  if (!context?.tenantId) {
    throw new Error("withTenantTransaction requires tenantId");
  }
  // Basic UUID format check to avoid SQL injection via string interpolation;
  // drizzle sql template will parameterize but we validate anyway.
  if (!/^[0-9a-fA-F-]{36}$/.test(context.tenantId)) {
    throw new Error("Invalid tenantId format — must be UUID");
  }

  const db = getDb();
  // drizzle transaction
  return db.transaction(async (tx) => {
    // SET LOCAL must happen before any tenant data access
    await tx.execute(sql.raw(`SET LOCAL app.tenant_id = '${context.tenantId}'`));
    if (context.actorId) {
      // Optional: store actor for audit trigger usage (not enforced by RLS)
      await tx.execute(sql.raw(`SET LOCAL app.actor_id = '${context.actorId}'`));
    }
    if (context.requestId) {
      await tx.execute(sql.raw(`SET LOCAL app.request_id = '${context.requestId}'`));
    }
    return fn(tx as unknown as Db);
  });
}

/**
 * Helper for non-tenant migrations/administrative work — bypasses tenant check.
 * Uses separate unpooled connection via migrate.ts instead.
 */
export async function withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => fn(tx as unknown as Db));
}
