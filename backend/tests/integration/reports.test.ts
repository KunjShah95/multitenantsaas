import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

async function login(email: string, password: string, slug?: string) {
  const body: Record<string, string> = { email, password };
  if (slug) body.organizationSlug = slug;
  const r = await request(app).post("/api/v1/auth/login").send(body);
  if (r.status !== 200) throw new Error(`login ${email} failed`);
  return r.body.data.accessToken as string;
}

describe("Phase 9 Reports and Exports", () => {
  let acmeAdmin: string;
  let globexAdmin: string;

  beforeAll(async () => {
    acmeAdmin = await login("alice@acme.test", "DemoPass123!", "acme");
    globexAdmin = await login("carol@globex.test", "DemoPass123!", "globex");
  }, 30000);

  it("fetches quotes report with aggregates and pagination", async () => {
    const res = await request(app)
      .get("/api/v1/reports/quotes?limit=10")
      .set("Authorization", `Bearer ${acmeAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.aggregates).toBeDefined();
    expect(typeof res.body.aggregates.totalCount).toBe("number");
    expect(res.body.aggregates.totalSubtotal).toBeDefined();
    expect(res.body.aggregates.totalNet).toBeDefined();
    expect(res.body.aggregates.totalGrand).toBeDefined();
    expect(res.body.aggregates.statusBreakdown).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeLessThanOrEqual(10);
  });

  it("fetches orders report with fulfillment breakdown", async () => {
    const res = await request(app)
      .get("/api/v1/reports/orders?limit=10")
      .set("Authorization", `Bearer ${acmeAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.aggregates).toBeDefined();
    expect(typeof res.body.aggregates.totalCount).toBe("number");
    expect(res.body.aggregates.statusBreakdown).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("fetches executive sales revenue and recurring run rate report", async () => {
    const res = await request(app)
      .get("/api/v1/reports/sales")
      .set("Authorization", `Bearer ${acmeAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.invoices).toBeDefined();
    expect(typeof res.body.invoices.totalCount).toBe("number");
    expect(res.body.invoices.totalInvoicedAmount).toBeDefined();
    expect(res.body.invoices.totalPaidAmount).toBeDefined();
    expect(res.body.subscriptions).toBeDefined();
    expect(typeof res.body.subscriptions.activeCount).toBe("number");
    expect(res.body.subscriptions.mrr).toBeDefined();
    expect(res.body.subscriptions.arr).toBeDefined();
  });

  it("generates durable report exports and allows authenticated token download", async () => {
    const idemKey = `export-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 1. Request export
    const createRes = await request(app)
      .post("/api/v1/report-exports")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("Idempotency-Key", idemKey)
      .send({
        reportType: "quotes",
        format: "csv",
      });

    expect(createRes.status).toBe(201);
    const exp = createRes.body.export;
    expect(exp.id).toBeDefined();
    expect(exp.reportType).toBe("quotes");
    expect(exp.format).toBe("csv");
    expect(exp.status).toBe("completed");
    expect(exp.downloadUrl).toBeDefined();

    // 2. Poll export status
    const statusRes = await request(app)
      .get(`/api/v1/report-exports/${exp.id}`)
      .set("Authorization", `Bearer ${acmeAdmin}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.id).toBe(exp.id);
    expect(statusRes.body.status).toBe("completed");

    // 3. Download with valid token
    const token = new URL(exp.downloadUrl, "http://localhost").searchParams.get("token")!;
    const dlRes = await request(app)
      .get(`/api/v1/report-exports/${exp.id}/download?token=${token}`)
      .set("Authorization", `Bearer ${acmeAdmin}`);

    expect(dlRes.status).toBe(200);
    expect(dlRes.headers["content-type"]).toContain("text/csv");
    expect(dlRes.headers["content-disposition"]).toContain("attachment;");
    expect(dlRes.text).toContain("Quote Number");

    // 4. Download with invalid token must return 403
    const invalidDlRes = await request(app)
      .get(`/api/v1/report-exports/${exp.id}/download?token=bogustoken123`)
      .set("Authorization", `Bearer ${acmeAdmin}`);

    expect(invalidDlRes.status).toBe(403);

    // 5. Cross-tenant download attempt must return 404
    const crossTenantDl = await request(app)
      .get(`/api/v1/report-exports/${exp.id}/download?token=${token}`)
      .set("Authorization", `Bearer ${globexAdmin}`);

    expect(crossTenantDl.status).toBe(404);
  });
});
