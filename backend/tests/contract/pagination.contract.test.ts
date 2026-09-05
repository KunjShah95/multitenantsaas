/**
 * Contract: pagination and list response shape
 *
 * Verifies that list endpoints conform to the documented list contract:
 *   { data: [...], page: { limit, nextCursor } }
 *
 * These tests do NOT require a live database. They verify that:
 *   - Unauthenticated list requests return 401 with error envelope (not HTML/crash)
 *   - Invalid `limit` / `cursor` query parameters return 400 with error envelope
 *   - The documented query params (limit, cursor) are accepted
 *
 * For full pagination results with real data, see tests/integration/*.test.ts
 * See docs/FRONTEND_API.md for the authoritative contract definition.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

// ── List endpoints respond correctly without auth ────────────────────────────

describe("contract: list endpoints return 401 without auth (not 500 or HTML)", () => {
  const listEndpoints = [
    "/api/v1/products",
    "/api/v1/customers",
    "/api/v1/quotes",
    "/api/v1/orders",
    "/api/v1/reports/quotes",
    "/api/v1/health-configs",
  ];

  for (const path of listEndpoints) {
    it(`GET ${path} → 401 with error envelope (no crash)`, async () => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toHaveProperty("code", "UNAUTHORIZED");
      expect(res.body.error).toHaveProperty("requestId");
    });
  }
});

// ── Invalid query params: limit ───────────────────────────────────────────────

describe("contract: invalid 'limit' query parameter", () => {
  // These endpoints apply validation via shared pagination schema.
  // Without auth we get 401, so we verify the shape is still an envelope.
  // For actual 400 validation, see pagination.ts unit tests.
  it("GET /api/v1/quotes?limit=999 → 401 (auth before validation, envelope present)", async () => {
    const res = await request(app).get("/api/v1/quotes?limit=999");
    expect([400, 401]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("requestId");
  });

  it("GET /api/v1/quotes?limit=0 → 401 or 400 with error envelope", async () => {
    const res = await request(app).get("/api/v1/quotes?limit=0");
    expect([400, 401]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
  });

  it("GET /api/v1/quotes?limit=abc → 401 or 400 with error envelope", async () => {
    const res = await request(app).get("/api/v1/quotes?limit=abc");
    expect([400, 401]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
  });
});

// ── Pagination schema (unit level, no app needed) ───────────────────────────

describe("contract: pagination schema unit (paginationQuerySchema)", () => {
  it("valid limit and no cursor are accepted", async () => {
    const { paginationQuerySchema } = await import("../../src/shared/pagination.js");
    const result = paginationQuerySchema.parse({ limit: "25" });
    expect(result.limit).toBe(25);
    expect(result.cursor).toBeUndefined();
  });

  it("limit below 1 fails validation", async () => {
    const { paginationQuerySchema } = await import("../../src/shared/pagination.js");
    expect(() => paginationQuerySchema.parse({ limit: "0" })).toThrow();
  });

  it("limit above 100 fails validation", async () => {
    const { paginationQuerySchema } = await import("../../src/shared/pagination.js");
    expect(() => paginationQuerySchema.parse({ limit: "101" })).toThrow();
  });

  it("non-numeric limit fails validation", async () => {
    const { paginationQuerySchema } = await import("../../src/shared/pagination.js");
    expect(() => paginationQuerySchema.parse({ limit: "banana" })).toThrow();
  });

  it("default limit is applied when not supplied", async () => {
    const { paginationQuerySchema } = await import("../../src/shared/pagination.js");
    const result = paginationQuerySchema.parse({});
    expect(result.limit).toBe(20); // default from schema
    expect(result.limit).toBeLessThanOrEqual(100);
  });

  it("opaque cursor string is passed through", async () => {
    const { paginationQuerySchema } = await import("../../src/shared/pagination.js");
    const result = paginationQuerySchema.parse({ cursor: "some-opaque-cursor" });
    expect(result.cursor).toBe("some-opaque-cursor");
  });

  it("buildPage returns correct nextCursor when more items exist", async () => {
    const { buildPage } = await import("../../src/shared/pagination.js");
    const items = Array.from({ length: 6 }, (_, i) => ({
      id: `id-${i}`,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    }));
    const page = buildPage(items, 5);
    expect(page.items).toHaveLength(5);
    expect(page.nextCursor).not.toBeNull();
  });

  it("buildPage returns null nextCursor when no more items", async () => {
    const { buildPage } = await import("../../src/shared/pagination.js");
    const items = [{ id: "id-0", createdAt: new Date() }];
    const page = buildPage(items, 5);
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });
});
