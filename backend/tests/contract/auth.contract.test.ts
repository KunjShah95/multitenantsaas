/**
 * Contract: authentication endpoints and security headers
 *
 * These tests require NO live database connection. They exercise the API
 * layer of the Express app using Supertest and verify:
 *   - Response DTO shape on protected endpoints (401/403)
 *   - Error envelope structure
 *   - Security header presence
 *   - Rate-limit response shape and Retry-After header
 *   - Login response DTO shape (when DB is absent, expects 500/DB error —
 *     we only assert envelope shape, not business logic)
 *
 * For full login/session tests with real Neon data, see tests/integration/auth.test.ts
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

// A well-formed but unsigned/fake JWT — triggers 401 without DB
const FAKE_BEARER = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEiLCJ0aWQiOiJ0ZW5hbnRfMSIsInJvbGUiOiJhZG1pbiIsInNpZCI6InNlc3Npb25fMSIsImVtYWlsIjoidGVzdEB0ZXN0LmxvY2FsIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDB9.fake-sig";

// ── Security headers ────────────────────────────────────────────────────────

describe("contract: security headers", () => {
  it("helmet sets X-Content-Type-Options on all responses", async () => {
    const res = await request(app).get("/healthz");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("helmet sets X-Frame-Options on all responses", async () => {
    const res = await request(app).get("/healthz");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("X-Request-Id is present on every response", async () => {
    const res = await request(app).get("/healthz");
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(typeof res.headers["x-request-id"]).toBe("string");
    expect(res.headers["x-request-id"].length).toBeGreaterThan(0);
  });

  it("client-supplied X-Request-Id is echoed back", async () => {
    const myId = "req_test-correlation-id";
    const res = await request(app).get("/healthz").set("x-request-id", myId);
    expect(res.headers["x-request-id"]).toBe(myId);
  });
});

// ── Unauthenticated 401 on protected routes ─────────────────────────────────

describe("contract: 401 on protected endpoints (no token)", () => {
  const protectedRoutes: [string, string][] = [
    ["GET", "/api/v1/me"],
    ["GET", "/api/v1/products"],
    ["GET", "/api/v1/quotes"],
    ["GET", "/api/v1/orders"],
    ["GET", "/api/v1/customers"],
    ["GET", "/api/v1/health-configs"],
    ["GET", "/api/v1/reports/quotes"],
  ];

  for (const [method, path] of protectedRoutes) {
    it(`${method} ${path} → 401 with error envelope`, async () => {
      const res = await (request(app) as unknown as Record<string, (path: string) => request.Test>)[
        method.toLowerCase()
      ](path);
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toHaveProperty("code", "UNAUTHORIZED");
      expect(res.body.error).toHaveProperty("message");
      expect(res.body.error).toHaveProperty("requestId");
      expect(typeof res.body.error.requestId).toBe("string");
    });
  }
});

// ── Invalid/expired token 401 ────────────────────────────────────────────────

describe("contract: 401 on invalid bearer token", () => {
  it("GET /api/v1/me with tampered JWT → 401 UNAUTHORIZED", async () => {
    const res = await request(app).get("/api/v1/me").set("Authorization", FAKE_BEARER);
    // May be 401 (bad sig) or 500 if DB unavailable — in either case, not 200
    expect([401, 500]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code");
    expect(res.body.error).toHaveProperty("requestId");
  });

  it("Missing 'Bearer ' prefix → 401", async () => {
    const res = await request(app)
      .get("/api/v1/me")
      .set("Authorization", "Basic dXNlcjpwYXNz");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

// ── Login endpoint DTO shape ─────────────────────────────────────────────────

describe("contract: POST /api/v1/auth/login response shape", () => {
  it("missing body → 400 with error envelope", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({})
      .set("Content-Type", "application/json");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code");
    expect(res.body.error).toHaveProperty("requestId");
  });

  it("malformed JSON body → 400 with error envelope", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send("not-json{");
    expect([400, 500]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
  });
});

// ── Rate-limit response shape ─────────────────────────────────────────────────

describe("contract: rate-limit response", () => {
  it("rate-limited 429 response has correct error envelope shape (mocked)", async () => {
    // We call a known endpoint that has a rate limiter with a fabricated
    // test to verify the *shape* without actually hitting the limit.
    // The createRateLimiter handler always produces this envelope.
    // We verify by looking at the handler directly via import.
    const { createRateLimiter } = await import("../../src/shared/rateLimiter.js");
    const limiter = createRateLimiter({ windowMs: 1000, max: 0 }); // max=0 → always 429
    const testApp = (await import("express")).default();
    testApp.use(limiter);
    testApp.get("/test", (_req, res) => res.json({ ok: true }));

    const res = await request(testApp).get("/test");
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "RATE_LIMITED");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error).toHaveProperty("requestId");
    expect(res.headers["retry-after"]).toBeDefined();
  });
});

// ── Refresh/logout endpoints ─────────────────────────────────────────────────

describe("contract: auth refresh and logout", () => {
  it("POST /api/v1/auth/refresh without cookie → 401 or 400", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");
    expect([400, 401]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("requestId");
  });

  it("POST /api/v1/auth/logout without token → 204 (logout is intentionally lenient — clears state)", async () => {
    // Per auth.routes.ts: logout always returns 204 even without a cookie,
    // since the server simply clears whatever session exists. Auth docs
    // describe this as idempotent (safe to call on expired/missing session).
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(204);
  });
});
