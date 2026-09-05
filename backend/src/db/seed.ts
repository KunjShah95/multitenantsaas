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

  console.log(
    "[seed] upserting Phase 3 demo config (tiers, categories, products, variants, warehouses)...",
  );
  for (const org of orgs) {
    // Tiers
    for (const tier of [
      { code: "Bronze", name: "Bronze", priority: 0 },
      { code: "Silver", name: "Silver", priority: 10 },
      { code: "Gold", name: "Gold", priority: 20 },
    ]) {
      await pool.query(
        `INSERT INTO customer_tiers (tenant_id, code, name, priority) VALUES ($1,$2,$3,$4)
         ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name`,
        [org.id, tier.code, tier.name, tier.priority],
      );
    }
    // Categories
    for (const cat of [
      { code: "Hardware", name: "Hardware" },
      { code: "Services", name: "Services" },
    ]) {
      await pool.query(
        `INSERT INTO product_categories (tenant_id, code, name) VALUES ($1,$2,$3)
         ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name`,
        [org.id, cat.code, cat.name],
      );
    }
  }
  // Need category ids for products
  const allCategories = await db.select().from(schema.productCategories);
  const catByTenantCode = new Map(allCategories.map((c) => [`${c.tenantId}:${c.code}`, c]));
  const allTiers = await db.select().from(schema.customerTiers);

  for (const org of orgs) {
    const hw = catByTenantCode.get(`${org.id}:Hardware`);
    const svc = catByTenantCode.get(`${org.id}:Services`);
    // Products
    for (const prod of [
      {
        sku: "LAP-PRO-15",
        name: "Laptop Pro 15",
        categoryId: hw?.id ?? null,
        unit: "ea",
        price: "1200.000000",
        cost: "800.000000",
        tax: "18.00",
      },
      {
        sku: "SETUP-SVC",
        name: "Setup Service",
        categoryId: svc?.id ?? null,
        unit: "lot",
        price: "500.000000",
        cost: "300.000000",
        tax: "10.00",
      },
      {
        sku: "SUP-STD",
        name: "Support Standard",
        categoryId: svc?.id ?? null,
        unit: "ea",
        price: "100.000000",
        cost: "40.000000",
        tax: "18.00",
      },
    ]) {
      await pool.query(
        `INSERT INTO products (tenant_id, category_id, sku, name, unit, standard_price, standard_cost, tax_rate_pct)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (tenant_id, sku) DO UPDATE SET name = EXCLUDED.name, standard_price = EXCLUDED.standard_price`,
        [org.id, prod.categoryId, prod.sku, prod.name, prod.unit, prod.price, prod.cost, prod.tax],
      );
    }
  }
  const allProducts = await db.select().from(schema.products);
  const prodByTenantSku = new Map(allProducts.map((p) => [`${p.tenantId}:${p.sku}`, p]));
  for (const org of orgs) {
    const laptop = prodByTenantSku.get(`${org.id}:LAP-PRO-15`);
    if (laptop) {
      for (const v of [
        { sku: null, attribute: "RAM", value: "8GB", extraPrice: "0.000000" },
        { sku: null, attribute: "RAM", value: "16GB", extraPrice: "150.000000" },
      ]) {
        // Check existence by product_id + attribute/value
        const existing = await pool.query(
          `SELECT id FROM product_variants WHERE tenant_id=$1 AND product_id=$2 AND attribute=$3 AND value=$4`,
          [org.id, laptop.id, v.attribute, v.value],
        );
        if (existing.rows.length === 0) {
          await pool.query(
            `INSERT INTO product_variants (tenant_id, product_id, attribute, value, extra_price) VALUES ($1,$2,$3,$4,$5)`,
            [org.id, laptop.id, v.attribute, v.value, v.extraPrice],
          );
        }
      }
    }
    // Warehouses
    for (const wh of [
      { code: "WH-001", name: "Main Warehouse", location: "US-East", weight: "1.0000" },
      { code: "WH-002", name: "Secondary Warehouse", location: "US-West", weight: "1.5000" },
    ]) {
      await pool.query(
        `INSERT INTO warehouses (tenant_id, code, name, location, shipping_cost_weight) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name`,
        [org.id, wh.code, wh.name, wh.location, wh.weight],
      );
    }
  }
  const allWarehouses = await db.select().from(schema.warehouses);
  for (const org of orgs) {
    const wh = allWarehouses.find((w) => w.tenantId === org.id && w.code === "WH-001");
    const laptop = prodByTenantSku.get(`${org.id}:LAP-PRO-15`);
    if (wh && laptop) {
      await pool.query(
        `INSERT INTO inventory_balances (tenant_id, warehouse_id, sku, on_hand_qty) VALUES ($1,$2,$3,$4)
         ON CONFLICT (tenant_id, warehouse_id, sku) DO UPDATE SET on_hand_qty = EXCLUDED.on_hand_qty`,
        [org.id, wh.id, laptop.sku, "100.000000"],
      );
    }
  }
  // Plans and upsell for demo
  for (const org of orgs) {
    for (const plan of [
      {
        code: "basic-monthly",
        name: "Basic Monthly",
        interval: "monthly",
        price: "99.000000",
        currency: "USD",
      },
      {
        code: "pro-yearly",
        name: "Pro Yearly",
        interval: "yearly",
        price: "999.000000",
        currency: "USD",
      },
    ]) {
      await pool.query(
        `INSERT INTO subscription_plans (tenant_id, code, name, billing_interval, price, currency) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name`,
        [org.id, plan.code, plan.name, plan.interval, plan.price, plan.currency],
      );
    }
  }

  // Verify idempotency: second run should not error and counts stable
  console.log(
    "[seed] done — tenants:",
    TENANTS.length,
    "users:",
    USERS.length,
    "customers:",
    CUSTOMERS.length,
  );
  await pool.end();
}

seed().catch((e) => {
  console.error("[seed] failed", e);
  process.exit(1);
});
