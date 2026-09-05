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

describe("Phase 9 Deal Health", () => {
  let acmeAdmin: string;
  let acmeRep: string;
  let globexAdmin: string;

  beforeAll(async () => {
    acmeAdmin = await login("alice@acme.test", "DemoPass123!", "acme");
    acmeRep = await login("bob@acme.test", "DemoPass123!", "acme");
    globexAdmin = await login("carol@globex.test", "DemoPass123!", "globex");
  }, 30000);

  it("performs manual deal health scan", async () => {
    const res = await request(app)
      .post("/api/v1/deal-health/scan")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.scanned).toBe(true);
    expect(typeof res.body.detectedCount).toBe("number");
  });

  it("returns deal health summary and alert list", async () => {
    const res = await request(app)
      .get("/api/v1/deal-health")
      .set("Authorization", `Bearer ${acmeAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(typeof res.body.summary.stalledCount).toBe("number");
    expect(typeof res.body.summary.anomalyCount).toBe("number");
    expect(typeof res.body.summary.slippageCount).toBe("number");
    expect(typeof res.body.summary.overdueCount).toBe("number");
    expect(typeof res.body.summary.totalActive).toBe("number");
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });

  it("enforces tenant isolation between Acme and Globex", async () => {
    const acmeRes = await request(app)
      .get("/api/v1/deal-health")
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(acmeRes.status).toBe(200);

    const globexRes = await request(app)
      .get("/api/v1/deal-health")
      .set("Authorization", `Bearer ${globexAdmin}`);
    expect(globexRes.status).toBe(200);

    const acmeAlertIds = new Set(acmeRes.body.alerts.map((a: { id: string }) => a.id));
    for (const gAlert of globexRes.body.alerts) {
      expect(acmeAlertIds.has(gAlert.id)).toBe(false);
    }
  });

  it("allows sales rep to access deal health", async () => {
    const res = await request(app)
      .get("/api/v1/deal-health")
      .set("Authorization", `Bearer ${acmeRep}`);
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
  });

  it("supports idempotent nudging on active alerts", async () => {
    const healthRes = await request(app)
      .get("/api/v1/deal-health")
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(healthRes.status).toBe(200);

    if (healthRes.body.alerts.length > 0) {
      const alertToNudge = healthRes.body.alerts[0];
      const idemKey = `nudge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // First nudge
      const nudgeRes1 = await request(app)
        .post(`/api/v1/deal-health/alerts/${alertToNudge.id}/nudge`)
        .set("Authorization", `Bearer ${acmeAdmin}`)
        .set("Idempotency-Key", idemKey)
        .send({ message: "Please review this stalled deal immediately." });

      expect(nudgeRes1.status).toBe(200);
      expect(nudgeRes1.body.alert.nudgeCount).toBeGreaterThanOrEqual(1);
      expect(nudgeRes1.body.notification).toBeDefined();
      expect(nudgeRes1.body.notification.title).toContain("Nudge");

      const countAfterFirst = nudgeRes1.body.alert.nudgeCount;

      // Duplicate nudge with same idempotency key
      const nudgeRes2 = await request(app)
        .post(`/api/v1/deal-health/alerts/${alertToNudge.id}/nudge`)
        .set("Authorization", `Bearer ${acmeAdmin}`)
        .set("Idempotency-Key", idemKey)
        .send({ message: "Please review this stalled deal immediately." });

      expect(nudgeRes2.status).toBe(200);
      expect(nudgeRes2.body.alert.nudgeCount).toBe(countAfterFirst);

      // Cross-tenant nudge attempt must fail with 404 (not found in Globex tenant)
      const crossTenantRes = await request(app)
        .post(`/api/v1/deal-health/alerts/${alertToNudge.id}/nudge`)
        .set("Authorization", `Bearer ${globexAdmin}`)
        .send({ message: "Intruder nudge" });

      expect(crossTenantRes.status).toBe(404);
    }
  });
});
