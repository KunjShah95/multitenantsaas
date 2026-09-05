import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { SseHub } from "../../src/domain/events/sse.hub.js";

const app = createApp();

async function login(email: string, password: string, slug?: string) {
  const body: Record<string, string> = { email, password };
  if (slug) body.organizationSlug = slug;
  const r = await request(app).post("/api/v1/auth/login").send(body);
  if (r.status !== 200) throw new Error(`login ${email} failed`);
  return {
    token: r.body.data.accessToken as string,
    tenantId: r.body.data.organization.id as string,
  };
}

describe("Phase 9 Tenant SSE Stream", () => {
  let acmeToken: string;
  let acmeTenantId: string;
  let server: http.Server;
  let serverPort: number;

  beforeAll(async () => {
    const auth = await login("alice@acme.test", "DemoPass123!", "acme");
    acmeToken = auth.token;
    acmeTenantId = auth.tenantId;

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        serverPort = (server.address() as import("node:net").AddressInfo).port;
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("establishes SSE stream and receives broadcast events with minimal payload", async () => {
    const receivedChunks: string[] = [];

    const req = http.request({
      hostname: "127.0.0.1",
      port: serverPort,
      path: "/api/v1/events",
      method: "GET",
      headers: {
        Authorization: `Bearer ${acmeToken}`,
        Accept: "text/event-stream",
      },
    });

    const streamPromise = new Promise<void>((resolve) => {
      req.on("response", (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toContain("text/event-stream");

        res.on("data", (chunk) => {
          const text = chunk.toString();
          receivedChunks.push(text);

          // Once we receive our broadcasted event, resolve
          if (text.includes("quote.updated")) {
            req.destroy();
            resolve();
          }
        });

        // Trigger a broadcast event to Acme
        setTimeout(() => {
          SseHub.broadcast(acmeTenantId, {
            eventId: "evt-123",
            type: "quote.updated",
            entityId: "quote-456",
            occurredAt: new Date().toISOString(),
          });
        }, 100);
      });
    });

    req.end();

    await streamPromise;

    const fullStream = receivedChunks.join("");
    expect(fullStream).toContain(": connected");
    expect(fullStream).toContain("event: quote.updated");
    expect(fullStream).toContain('"eventId":"evt-123"');
    expect(fullStream).toContain('"entityId":"quote-456"');

    // Verify minimal payload: must not contain full quote lines or sensitive record blobs
    expect(fullStream).not.toContain("password");
    expect(fullStream).not.toContain("lineItems");
  });
});
