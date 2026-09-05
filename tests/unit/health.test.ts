import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

describe("foundation probes", () => {
  it("GET /healthz returns 200 with status ok", async () => {
    const app = createApp();
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.app).toBe("DealFlow360");
  });

  it("GET /readyz returns 200 and deferred database check (Phase 0)", async () => {
    const app = createApp();
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    const dbCheck = res.body.checks.find((c: { name: string }) => c.name === "database");
    expect(dbCheck.status).toBe("deferred");
  });

  it("sets x-request-id and uses single error envelope for 404", async () => {
    const app = createApp();
    const res = await request(app).get("/nope-not-found");
    expect(res.status).toBe(404);
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.requestId).toBeDefined();
  });

  it("propagates incoming x-request-id", async () => {
    const app = createApp();
    const res = await request(app).get("/healthz").set("x-request-id", "req_test123");
    expect(res.headers["x-request-id"]).toBe("req_test123");
  });
});
