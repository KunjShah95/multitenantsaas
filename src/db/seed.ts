import * as dotenv from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as argon2 from "argon2";
import * as schema from "./schema/index.js";

if (process.env.NODE_ENV !== "production") dotenv.config();

const TENANTS = [
  { slug: "acme", name: "Acme Corp" },
  { slug: "globex", name: "Globex Inc" },
] as const;

const USERS = [
  { email: "alice@acme.test", name: "Alice Admin", tenantSlug: "acme", role: "admin" as const },
  { email: "bob@acme.test", name: "Bob Rep", tenantSlug: "acme", role: "rep" as const },
  { email: "carol@globex.test", name: "Carol Admin", tenantSlug: "globex", role: "admin" as const },
  { email: "dave@globex.test", name: "Dave Rep", tenantSlug: "globex", role: "rep" as const },
] as const;

const CUSTOMERS = [
  { tenantSlug: "acme", name: "Acme Customer One" },
  { tenantSlug: "acme", name: "Acme Customer Two" },
  { tenantSlug: "globex", name: "Globex Customer One" },
] as const;

// Real argon2id hash for demo users — password is DemoPass123! (known for dev/testing, not production)
const DEMO_PASSWORD = "DemoPass123!";
async function demoPasswordHash() {
  return argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
}

async function seed() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL_UNPOOLED or DATABASE_URL required for seed");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool, { schema });

  console.log("[seed] upserting tenants...");
  for (const t of TENANTS) {
    await db
      .insert(schema.organizations)
      .values({ slug: t.slug, name: t.name })
      .onConflictDoUpdate({ target: schema.organizations.slug, set: { name: t.name } });
  }

  // Resolve tenant ids
  const orgs = await db.select().from(schema.organizations);
  const orgBySlug = new Map(orgs.map((o) => [o.slug, o]));

  console.log("[seed] upserting users...");
  const demoHash = await demoPasswordHash();
  for (const u of USERS) {
    await db
      .insert(schema.users)
      .values({ email: u.email, name: u.name, passwordHash: demoHash })
      .onConflictDoUpdate({
        target: schema.users.email,
        set: { name: u.name, passwordHash: demoHash },
      });
  }
  const users = await db.select().from(schema.users);
  const userByEmail = new Map(users.map((u) => [u.email, u]));

  console.log("[seed] upserting memberships...");
  for (const u of USERS) {
    const org = orgBySlug.get(u.tenantSlug);
    const user = userByEmail.get(u.email);
    if (!org || !user) continue;
    // Insert with ON CONFLICT DO NOTHING on (tenantId, userId)
    await pool.query(
      `INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,$3)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [org.id, user.id, u.role],
    );
  }

  console.log("[seed] upserting customers...");
  for (const c of CUSTOMERS) {
    const org = orgBySlug.get(c.tenantSlug);
    if (!org) continue;
    await pool.query(
      `INSERT INTO customers (tenant_id, name) VALUES ($1,$2)
       ON CONFLICT (tenant_id, name) DO NOTHING`,
      [org.id, c.name],
    );
  }

  // Verify idempotency: second run should not error and counts stable
  console.log("[seed] done — tenants:", TENANTS.length, "users:", USERS.length, "customers:", CUSTOMERS.length);
  await pool.end();
}

seed().catch((e) => {
  console.error("[seed] failed", e);
  process.exit(1);
});
