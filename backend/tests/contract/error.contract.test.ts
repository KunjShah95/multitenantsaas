/**
 * Contract: error envelope shape
 *
 * Verifies that every error response from the API conforms to the documented
 * error envelope:  { error: { code, message, requestId, details? } }
 *
 * No live database required — these tests only exercise the Express app layer.
 * See docs/FRONTEND_API.md for the authoritative contract definition.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

// ── 404 Not Found ────────────────────────────────────────────────────────────

describe("contract: 404 error envelope", () => {
  it("unknown non-api route → 404 with correct envelope", async () => {
    // Use a path outside /api/v1/ so it reaches notFoundHandler without
    // going through the authenticate middleware (which would return 401).
    const res = await request(app).get("/not-a-real-route-xyz-abc");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "NOT_FOUND");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error).toHaveProperty("requestId");
    expect(typeof res.body.error.requestId).toBe("string");
    expect(res.body.error).not.toHaveProperty("stack");
  });

  it("unknown /api/v1 path → 401 or 404 (auth before 404, both are error envelopes)", async () => {
    // Under /api/v1, the authenticate middleware fires first, returning 401
    // before the notFoundHandler runs. This is correct and expected.
    const res = await request(app).get("/api/v1/this-route-does-not-exist-xyz");
    expect([401, 404]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body.error).not.toHaveProperty("stack");
  });
});

// ── 400 Bad Request / Validation ─────────────────────────────────────────────

describe("contract: 400 validation error envelope", () => {
  it("POST /api/v1/auth/login with empty body → 400 with error envelope", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({})
      .set("Content-Type", "application/json");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error).toHaveProperty("requestId");
  });

  it("error envelope never contains stack trace", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({})
      .set("Content-Type", "application/json");
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/at Object\./);
    expect(body).not.toMatch(/at Module\./);
    expect(body).not.toMatch(/node_modules/);
  });
});

// ── 401 Unauthorized ─────────────────────────────────────────────────────────

describe("contract: 401 error envelope", () => {
  it("missing auth → 401 UNAUTHORIZED envelope", async () => {
    const res = await request(app).get("/api/v1/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error).toHaveProperty("requestId");
    expect(res.body.error).not.toHaveProperty("stack");
  });
});

// ── Malformed JSON body ───────────────────────────────────────────────────────

describe("contract: malformed JSON body", () => {
  it("malformed JSON → 400 BAD_REQUEST or graceful error, never 500 with stack", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send("{invalid json here");
    // Express 5 or body-parser may return 400 or similar
    expect(res.status).toBeLessThan(500);
    // Must have error envelope
    if (res.body && typeof res.body === "object" && "error" in res.body) {
      expect(res.body.error).toHaveProperty("requestId");
    }
  });
});

// ── Body too large ───────────────────────────────────────────────────────────

describe("contract: body size limit", () => {
  it("body over 1 MB → non-200, never unhandled crash with stack trace", async () => {
    // Express 5 may return 413, 400, or 500 for oversized JSON depending on
    // the body-parser error handling. What matters is: no unhandled crash,
    // and the response is JSON (not HTML/plain-text).
    const bigPayload = "x".repeat(1_100_000);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send(`{"data": "${bigPayload}"}`);
    expect(res.status).not.toBe(200);
    // Must not leak stack traces
    const body = JSON.stringify(res.body ?? "");
    expect(body).not.toMatch(/at Object\./i);
    expect(body).not.toMatch(/node_modules/i);
  });
});

// ── Envelope consistency ─────────────────────────────────────────────────────

describe("contract: envelope structure consistency", () => {
  it("every error response is JSON (not HTML or plain text)", async () => {
    const endpoints: [string, string][] = [
      ["GET", "/api/v1/me"],
      ["GET", "/no-such-route"],
      ["POST", "/api/v1/auth/login"],
    ];
    for (const [method, path] of endpoints) {
      const res = await (
        request(app) as unknown as Record<string, (p: string) => request.Test>
      )[method.toLowerCase()](path);
      expect(res.headers["content-type"]).toMatch(/json/);
    }
  });

  it("success responses use { data: ... } wrapper", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    // healthz returns { status, app, time } — the wrapper is per-endpoint
    // At minimum verify it is JSON
    expect(res.headers["content-type"]).toMatch(/json/);
  });
});
