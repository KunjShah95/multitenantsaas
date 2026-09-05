import { describe, it, expect } from "vitest";
import { parseEnv, __resetEnvCache } from "../../src/config/env.js";

describe("env validation", () => {
  it("parses minimal development env (Phase 0 tolerates missing Neon)", () => {
    const env = parseEnv({
      NODE_ENV: "development",
      PORT: "4000",
      APP_ORIGIN: "http://localhost:5173",
      PORTAL_ORIGIN: "http://localhost:5173",
    });
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(4000);
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("fails clearly in production when secrets missing", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        PORT: "4000",
        APP_ORIGIN: "http://localhost:5173",
        PORTAL_ORIGIN: "http://localhost:5173",
      }),
    ).toThrow(/Environment validation failed/);
    process.env.NODE_ENV = prev;
    __resetEnvCache();
  });

  it("accepts pooled DATABASE_URL format", () => {
    const env = parseEnv({
      NODE_ENV: "development",
      PORT: "4000",
      DATABASE_URL: "postgresql://user:pass@ep-test-pooler.neon.tech/db?sslmode=require",
      DATABASE_URL_UNPOOLED: "postgresql://user:pass@ep-test.neon.tech/db?sslmode=require",
      APP_ORIGIN: "http://localhost:5173",
      PORTAL_ORIGIN: "http://localhost:5173",
    });
    expect(env.DATABASE_URL).toContain("pooler");
  });
});
