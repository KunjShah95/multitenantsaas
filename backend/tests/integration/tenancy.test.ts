import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { sql, eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import { getDb, closeDb } from "../../src/db/connection.js";
import { withTenantTransaction } from "../../src/db/transaction.js";
import * as schema from "../../src/db/schema/index.js";
import { writeAuditEvent } from "../../src/shared/audit.js";
import { storeIdempotency, findIdempotency } from "../../src/shared/idempotency.js";
import { getRuntimeDb, closeRuntimeDb, withRuntimeTenantTransaction } from "./helpers.js";

dotenv.config();

const TENANT_A_SLUG = "test-tenant-a";
const TENANT_B_SLUG = "test-tenant-b";

describe("Phase 01 — Neon tenancy, RLS, constraints, audit, idempotency", () => {
  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const db = getDb();
    const orgs = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, TENANT_A_SLUG));
    if (orgs.length === 0) {
      const [o] = await db
        .insert(schema.organizations)
        .values({ slug: TENANT_A_SLUG, name: "Test Tenant A" })
        .returning();
      tenantAId = o!.id;
    } else tenantAId = orgs[0]!.id;

    const orgsB = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, TENANT_B_SLUG));
    if (orgsB.length === 0) {
      const [o] = await db
        .insert(schema.organizations)
        .values({ slug: TENANT_B_SLUG, name: "Test Tenant B" })
        .returning();
      tenantBId = o!.id;
    } else tenantBId = orgsB[0]!.id;

    const uA = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "tenant-a-user@test.local"));
    if (uA.length === 0) {
      const [u] = await db
        .insert(schema.users)
        .values({ email: "tenant-a-user@test.local", name: "Tenant A User" })
        .returning();
      userAId = u!.id;
    } else userAId = uA[0]!.id;

    const uB = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "tenant-b-user@test.local"));
    if (uB.length === 0) {
      const [u] = await db
        .insert(schema.users)
        .values({ email: "tenant-b-user@test.local", name: "Tenant B User" })
        .returning();
      userBId = u!.id;
    } else userBId = uB[0]!.id;

    const rawPool = new Pool({ connectionString: process.env.DATABASE_URL!, max: 1 });
    await rawPool.query(
      `INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'admin') ON CONFLICT (tenant_id, user_id) DO NOTHING`,
      [tenantAId, userAId],
    );
    await rawPool.query(
      `INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'admin') ON CONFLICT (tenant_id, user_id) DO NOTHING`,
      [tenantBId, userBId],
    );
    await rawPool.end();

    // Ensure each tenant has a customer — use runtime transaction so RLS enforced correctly
    await withRuntimeTenantTransaction({ tenantId: tenantAId }, async (tx: any) => {
      const existing = await tx.select().from(schema.customers).limit(1);
      if (existing.length === 0) {
        await tx
          .insert(schema.customers)
          .values({ tenantId: tenantAId, name: `Customer-A-${Date.now()}` });
      }
      try {
        await tx.insert(schema.customers).values({ tenantId: tenantAId, name: "Probe Customer A" });
      } catch {}
    });

    await withRuntimeTenantTransaction({ tenantId: tenantBId }, async (tx: any) => {
      const existing = await tx.select().from(schema.customers).limit(1);
      if (existing.length === 0) {
        await tx
          .insert(schema.customers)
          .values({ tenantId: tenantBId, name: `Customer-B-${Date.now()}` });
      }
      try {
        await tx.insert(schema.customers).values({ tenantId: tenantBId, name: "Probe Customer B" });
      } catch {}
    });
  });

  afterAll(async () => {
    await closeDb();
    await closeRuntimeDb();
  });

  it("same tenant can read own data via withTenantTransaction (runtime role)", async () => {
    const result = await withRuntimeTenantTransaction({ tenantId: tenantAId }, async (tx: any) => {
      return tx.select().from(schema.customers);
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r: any) => r.tenantId === tenantAId)).toBe(true);
  });

  it("cross-tenant data is blocked by RLS (tenant A cannot see tenant B's customer)", async () => {
    const bCustomers = await withRuntimeTenantTransaction(
      { tenantId: tenantBId },
      async (tx: any) => {
        return tx.select().from(schema.customers);
      },
    );
    expect(bCustomers.length).toBeGreaterThan(0);
    const bCustomerId = bCustomers[0]!.id;

    const aViewOfB = await withRuntimeTenantTransaction(
      { tenantId: tenantAId },
      async (tx: any) => {
        const rows = await tx
          .select()
          .from(schema.customers)
          .where(eq(schema.customers.id, bCustomerId));
        return rows;
      },
    );
    expect(aViewOfB.length).toBe(0);

    await expect(
      withRuntimeTenantTransaction({ tenantId: tenantAId }, async (tx: any) => {
        await tx.insert(schema.customers).values({ tenantId: tenantBId, name: "Illicit Customer" });
      }),
    ).rejects.toThrow();
  });

  it("deliberately unscoped repository attempt returns 0 rows due to RLS (no tenant set, runtime role)", async () => {
    const db = getRuntimeDb() as any;
    const rows = await db.select().from(schema.customers).limit(5);
    expect(rows.length).toBe(0);
  });

  it("missing tenant context fails", async () => {
    // @ts-expect-error testing missing tenant
    await expect(
      withTenantTransaction({} as unknown as { tenantId: string }, async (tx) =>
        tx.select().from(schema.customers),
      ),
    ).rejects.toThrow(/requires tenantId/);
    // @ts-expect-error empty string
    await expect(withTenantTransaction({ tenantId: "" }, async () => {})).rejects.toThrow();
    await expect(
      withRuntimeTenantTransaction({ tenantId: "" } as any, async () => {}),
    ).rejects.toThrow();
  });

  it("check constraint works (invalid role)", async () => {
    await expect(
      withRuntimeTenantTransaction({ tenantId: tenantAId }, async (tx: any) => {
        await tx
          .insert(schema.memberships)
          .values({ tenantId: tenantAId, userId: userAId, role: "superadmin" });
      }),
    ).rejects.toThrow();
  });

  it("FK constraint works (invalid tenant_id)", async () => {
    const fakeTenant = "00000000-0000-0000-0000-000000000000";
    await expect(
      withRuntimeTenantTransaction({ tenantId: fakeTenant }, async (tx: any) => {
        await tx.insert(schema.customers).values({ tenantId: fakeTenant, name: "FK fail" });
      }),
    ).rejects.toThrow();
  });

  it("audit_events and idempotency_keys unique rules work", async () => {
    const op = "testOperation";
    const key = `key-${Date.now()}`;
    await withRuntimeTenantTransaction({ tenantId: tenantAId }, async (tx: any) => {
      await writeAuditEvent(tx, {
        tenantId: tenantAId,
        actorId: userAId,
        action: "test.audit",
        entityType: "customer",
        entityId: null,
      });
      await storeIdempotency(tx, {
        tenantId: tenantAId,
        actorId: userAId,
        operation: op,
        key,
        requestHash: "hash1",
        responseStatus: "200",
        responseBody: { ok: true },
      });
      const found = await findIdempotency(tx, {
        tenantId: tenantAId,
        actorId: userAId,
        operation: op,
        key,
      });
      expect(found).toBeDefined();
      expect(found!.key).toBe(key);
    });

    await expect(
      withRuntimeTenantTransaction({ tenantId: tenantAId }, async (tx: any) => {
        await storeIdempotency(tx, { tenantId: tenantAId, actorId: userAId, operation: op, key });
      }),
    ).rejects.toThrow();
  });

  it("cross-tenant insert blocked by RLS WITH CHECK", async () => {
    await expect(
      withRuntimeTenantTransaction({ tenantId: tenantAId }, async (tx: any) => {
        await tx.insert(schema.auditEvents).values({
          tenantId: tenantBId,
          action: "test.cross",
          entityType: "test",
        });
      }),
    ).rejects.toThrow();
  });

  it("migration works and RLS is forced", async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED!, max: 1 });
    const r = await pool.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='customers'`,
    );
    expect(r.rows[0].relrowsecurity).toBe(true);
    expect(r.rows[0].relforcerowsecurity).toBe(true);
    await pool.end();
  });
});
