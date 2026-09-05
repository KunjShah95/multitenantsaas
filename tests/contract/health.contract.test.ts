import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

describe("contract: health probes and error envelope", () => {
  it("error envelope shape matches docs/03-backend-architecture", async () => {
    const app = createApp();
    const res = await request(app).get("/unknown-route-xyz");
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error).toHaveProperty("requestId");
    expect(typeof res.body.error.requestId).toBe("string");
  });

  it("/healthz is unauthenticated and stable contract", async () => {
    const app = createApp();
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: "ok",
        app: expect.any(String),
        time: expect.any(String),
      }),
    );
  });
});
