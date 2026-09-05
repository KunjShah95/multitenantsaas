import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

async function run() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
     
    console.error("DATABASE_URL_UNPOOLED or DATABASE_URL is required for migrations");
    process.exit(1);
  }
  // Use unpooled connection for migrations (Neon direct)
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);

   
  console.log(`[migrate] applying migrations from ${migrationsFolder}...`);
  await migrate(db, { migrationsFolder });
   
  console.log("[migrate] done");
  await pool.end();
}

run().catch((err) => {
   
  console.error("[migrate] failed", err);
  process.exit(1);
});
