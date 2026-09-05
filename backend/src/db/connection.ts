import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index.js";

let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

export type Db = NodePgDatabase<typeof schema>;

/**
 * Get pooled DB instance (uses DATABASE_URL).
 * Bounded pool, no schema action at startup.
 */
export function getDb(): Db {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — required for runtime DB connection");
  }
  pool = new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // Neon requires SSL; URL already contains sslmode=require
  });

  pool.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[db] pool idle client error", err);
  });

  db = drizzle(pool, { schema });
  return db;
}

export function getPool(): Pool {
  if (!pool) getDb();
  return pool!;
}

/**
 * Clean shutdown — call on process exit.
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

// Ensure graceful shutdown
if (typeof process !== "undefined") {
  const close = () => {
    if (pool) {
      void closeDb();
    }
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
