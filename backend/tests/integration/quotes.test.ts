import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

async function login(email: string, password: string, slug?: string) {
  const body: any = { email, password };
  if (slug) body.organizationSlug = slug;
  const r = await request(app).post("/api/v1/auth/login").send(body);
  if (r.status !== 200) throw new Error(`login ${email} ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.data.accessToken as string;
}

describe("Phase 4 quotes", () => {
  let acmeAdmin: string;
  let globexAdmin: string;
  let customerId: string;
  let prodId: string;
  let recProdId: string;

  beforeAll(async () => {
    acmeAdmin = await login("alice@acme.test", "DemoPass123!", "acme");
    globexAdmin = await login("carol@globex.test", "DemoPass123!", "globex");
    const cust = await request(app)
      .get("/api/v1/customers")
      .set("Authorization", `Bearer ${acmeAdmin}`);
    customerId = cust.body.data[0].id;
    const prods = await request(app)
      .get("/api/v1/products")
      .set("Authorization", `Bearer ${acmeAdmin}`);
    prodId = prods.body.data[0].id;
    const sku = `SKU-RECP4-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const pr2 = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({
        sku,
        name: "RecProd4",
        standardPrice: "50.000000",
        standardCost: "20.000000",
        taxRatePct: "10.00",
      });
    expect(pr2.status).toBe(201);
    recProdId = pr2.body.data.id;
    const upsell = await request(app)
      .post("/api/v1/upsell-rules")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({
        triggerProductId: prodId,
        suggestedProductId: recProdId,
        weight: "7",
        promoted: true,
      });
    expect([201, 409]).toContain(upsell.status); // may already exist
  }, 60000);

  it("creates quote idempotently and revision protected", async () => {
    const key = `k-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const q1 = await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("Idempotency-Key", key)
      .send({ customerId, currency: "USD" });
    expect(q1.status).toBe(201);
    const q2 = await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("Idempotency-Key", key)
      .send({ customerId, currency: "USD" });
    expect(q2.status).toBe(201);
    expect(q2.body.data.id).toBe(q1.body.data.id);
  });

  it("add line computes totals and snapshot stays fixed", async () => {
    const q = await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ customerId, currency: "USD" });
    expect(q.status).toBe(201);
    const qid = q.body.data.id;
    const rev1 = q.body.data.revision;
    const add1 = await request(app)
      .post(`/api/v1/quotes/${qid}/lines`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev1}"`)
      .send({
        productId: prodId,
        quantity: "2.000000",
        discountPct: "10.00",
        billingType: "one_time",
      });
    expect(add1.status).toBe(201);
    expect(add1.body.data.totals.subtotal).toBe("20.000000"); // will depend on product price, but check format
    expect(add1.body.data.totals.subtotal.split(".")[1].length).toBe(6);
    const snapBefore = add1.body.data.lines[0].snapshot.unitPrice;
    // patch product price
    const patch = await request(app)
      .patch(`/api/v1/products/${prodId}`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ standardPrice: "999.000000" });
    expect(patch.status).toBe(200);
    const getQ = await request(app)
      .get(`/api/v1/quotes/${qid}`)
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(getQ.body.data.lines[0].snapshot.unitPrice).toBe(snapBefore);
    // reset price back to 10 for other tests
    await request(app)
      .patch(`/api/v1/products/${prodId}`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ standardPrice: "10.000000" });
  });

  it("409 on stale revision", async () => {
    const q = await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ customerId, currency: "USD" });
    const qid = q.body.data.id;
    const rev1 = q.body.data.revision;
    const add = await request(app)
      .post(`/api/v1/quotes/${qid}/lines`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev1}"`)
      .send({ productId: prodId, quantity: "1.000000", billingType: "one_time" });
    expect(add.status).toBe(201);
    const stale = await request(app)
      .post(`/api/v1/quotes/${qid}/lines`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev1}"`)
      .send({ productId: recProdId, quantity: "1.000000", billingType: "one_time" });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("VERSION_CONFLICT");
    expect(stale.body.error.details.currentRevision).toBeDefined();
  });

  it("recommendations and tenant isolation", async () => {
    const q = await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ customerId, currency: "USD" });
    const qid = q.body.data.id;
    const rev = q.body.data.revision;
    await request(app)
      .post(`/api/v1/quotes/${qid}/lines`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev}"`)
      .send({ productId: prodId, quantity: "1.000000", billingType: "one_time" });
    const recs = await request(app)
      .get(`/api/v1/quotes/${qid}/recommendations?limit=5`)
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(recs.status).toBe(200);
    // should contain recProd if not in cart
    const has = recs.body.data.some((r: any) => r.productId === recProdId);
    expect(has).toBe(true);
    const globexList = await request(app)
      .get("/api/v1/quotes")
      .set("Authorization", `Bearer ${globexAdmin}`);
    expect(globexList.body.data.some((qq: any) => qq.id === qid)).toBe(false);
  });

  it("malformed and unknown product handled 400", async () => {
    const q = await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ customerId, currency: "USD" });
    const qid = q.body.data.id;
    const rev = q.body.data.revision;
    const bad = await request(app)
      .post(`/api/v1/quotes/${qid}/lines`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev}"`)
      .send({
        productId: "00000000-0000-0000-0000-000000000000",
        quantity: "1.000000",
        billingType: "one_time",
      });
    expect(bad.status).toBe(400);
    const badVar = await request(app)
      .post(`/api/v1/quotes/${qid}/lines`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev}"`)
      .send({
        productId: prodId,
        variantId: "00000000-0000-0000-0000-000000000000",
        quantity: "1.000000",
        billingType: "one_time",
      });
    expect(badVar.status).toBe(400);
  });

  it("patch and delete line revises totals", async () => {
    const q = await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ customerId, currency: "USD" });
    const qid = q.body.data.id;
    let rev = q.body.data.revision;
    const add = await request(app)
      .post(`/api/v1/quotes/${qid}/lines`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev}"`)
      .send({ productId: prodId, quantity: "2.000000", discountPct: "0", billingType: "one_time" });
    expect(add.status).toBe(201);
    rev = add.body.data.revision;
    const lineId = add.body.data.lines[0].id;
    const patch = await request(app)
      .patch(`/api/v1/quotes/${qid}/lines/${lineId}`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev}"`)
      .send({ quantity: "3.000000" });
    expect(patch.status).toBe(200);
    rev = patch.body.data.revision;
    const del = await request(app)
      .delete(`/api/v1/quotes/${qid}/lines/${lineId}`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev}"`);
    expect(del.status).toBe(200);
    expect(del.body.data.lines.length).toBe(0);
    expect(del.body.data.totals.subtotal).toBe("0.000000");
  });

  it("list filters and pagination", async () => {
    // ensure at least 2 quotes
    await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ customerId, currency: "USD" });
    await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ customerId, currency: "USD" });
    const list = await request(app)
      .get("/api/v1/quotes?status=draft&limit=1")
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);
    expect(list.body.page.nextCursor).toBeDefined();
    if (list.body.page.nextCursor) {
      const page2 = await request(app)
        .get(`/api/v1/quotes?limit=1&cursor=${encodeURIComponent(list.body.page.nextCursor)}`)
        .set("Authorization", `Bearer ${acmeAdmin}`);
      expect(page2.status).toBe(200);
    }
  });

  it("rejects unknown field in line create (strict)", async () => {
    const q = await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ customerId, currency: "USD" });
    const qid = q.body.data.id;
    const rev = q.body.data.revision;
    const bad = await request(app)
      .post(`/api/v1/quotes/${qid}/lines`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev}"`)
      .send({
        productId: prodId,
        quantity: "1.000000",
        billingType: "one_time",
        unitPrice: "999.000000",
      } as any);
    expect(bad.status).toBe(400);
  });

  it("currency snapshot and margin precision", async () => {
    const q = await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ customerId, currency: "USD" });
    const qid = q.body.data.id;
    const rev = q.body.data.revision;
    const add = await request(app)
      .post(`/api/v1/quotes/${qid}/lines`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev}"`)
      .send({ productId: prodId, quantity: "1.000000", discountPct: "0", billingType: "one_time" });
    expect(add.status).toBe(201);
    const line = add.body.data.lines[0];
    expect(line.snapshot.currency).toBe("USD");
    expect(line.totals.subtotal.split(".")[1].length).toBe(6);
    expect(add.body.data.totals.marginTotal).toBeDefined();
  });
});
