import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "../../src/db/schema/index.js";

let runtimePool: Pool | null = null;
let runtimeDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getRuntimeUrl(): string {
  if (process.env.RUNTIME_DATABASE_URL) return process.env.RUNTIME_DATABASE_URL;
  if (process.env.RUNTIME_DATABASE_URL_UNPOOLED) return process.env.RUNTIME_DATABASE_URL_UNPOOLED;
  const pwd = process.env.TEST_RUNTIME_PASSWORD;
  if (pwd) {
    const base = process.env.DATABASE_URL!;
    return base.replace(
      /postgresql:\/\/[^@]+@/,
      `postgresql://app_runtime:${encodeURIComponent(pwd)}@`,
    );
  }
  throw new Error(
    "RUNTIME_DATABASE_URL or TEST_RUNTIME_PASSWORD not set — create app_runtime role via src/db/roles.sql and set RUNTIME_DATABASE_URL (or TEST_RUNTIME_PASSWORD) in untracked .env for RLS integration tests",
  );
}

export function getRuntimeDb() {
  if (runtimeDb) return runtimeDb as unknown as ReturnType<typeof drizzle>;
  const url = getRuntimeUrl();
  runtimePool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });
  runtimePool.on("error", (e) => console.error("[runtimePool] error", e));
  runtimeDb = drizzle(runtimePool, { schema });
  return runtimeDb as unknown as ReturnType<typeof drizzle>;
}

export function getRuntimePool(): Pool {
  if (!runtimePool) getRuntimeDb();
  return runtimePool!;
}

export async function closeRuntimeDb() {
  if (runtimePool) {
    await runtimePool.end();
    runtimePool = null;
    runtimeDb = null;
  }
}

export async function withRuntimeTenantTransaction<T>(
  context: { tenantId: string; actorId?: string; requestId?: string },
  fn: (tx: ReturnType<typeof drizzle>) => Promise<T>,
): Promise<T> {
  if (!context?.tenantId) throw new Error("withRuntimeTenantTransaction requires tenantId");
  if (!/^[0-9a-fA-F-]{36}$/.test(context.tenantId)) throw new Error("Invalid tenantId");
  const db = getRuntimeDb() as unknown as {
    transaction: (cb: (tx: unknown) => Promise<T>) => Promise<T>;
  };
  return db.transaction(async (tx: unknown) => {
    const t = tx as { execute: (q: unknown) => Promise<unknown> };
    await t.execute(sql.raw(`SET LOCAL app.tenant_id = '${context.tenantId}'`));
    if (context.actorId) await t.execute(sql.raw(`SET LOCAL app.actor_id = '${context.actorId}'`));
    if (context.requestId)
      await t.execute(sql.raw(`SET LOCAL app.request_id = '${context.requestId}'`));
    return fn(tx as ReturnType<typeof drizzle>);
  });
}
