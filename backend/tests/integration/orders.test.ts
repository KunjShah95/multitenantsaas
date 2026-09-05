import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

async function login(email: string, password: string, slug?: string) {
  const body: Record<string, string> = { email, password };
  if (slug) body.organizationSlug = slug;
  const r = await request(app).post("/api/v1/auth/login").send(body);
  if (r.status !== 200) throw new Error(`login ${email} ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.data.accessToken as string;
}

describe("Phase 7 Orders & Inventory Fulfillment", () => {
  let acmeAdmin: string;
  let globexAdmin: string;
  let customerId: string;
  let prodId: string;
  let prodSku: string;
  let warehouse1Id: string;
  let warehouse2Id: string;

  beforeAll(async () => {
    acmeAdmin = await login("alice@acme.test", "DemoPass123!", "acme");
    globexAdmin = await login("carol@globex.test", "DemoPass123!", "globex");

    // Fetch customer
    const custRes = await request(app).get("/api/v1/customers").set("Authorization", `Bearer ${acmeAdmin}`);
    customerId = custRes.body.data[0].id;

    // Create unique product for test
    prodSku = `SKU-P7-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const prodRes = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({
        sku: prodSku,
        name: "Phase 7 Test Item",
        standardPrice: "100.000000",
        standardCost: "40.000000",
        taxRatePct: "10.00",
      });
    expect(prodRes.status).toBe(201);
    prodId = prodRes.body.data.id;

    // Fetch or create warehouses
    const whRes = await request(app).get("/api/v1/warehouses").set("Authorization", `Bearer ${acmeAdmin}`);
    if (whRes.body.data && whRes.body.data.length >= 2) {
      warehouse1Id = whRes.body.data[0].id;
      warehouse2Id = whRes.body.data[1].id;
    } else {
      const wh1 = await request(app)
        .post("/api/v1/warehouses")
        .set("Authorization", `Bearer ${acmeAdmin}`)
        .send({
          code: `WH1-${Date.now()}`,
          name: "Main Distribution Center",
          shippingCostWeight: "1.0000",
        });
      const wh2 = await request(app)
        .post("/api/v1/warehouses")
        .set("Authorization", `Bearer ${acmeAdmin}`)
        .send({
          code: `WH2-${Date.now()}`,
          name: "Secondary Depot",
          shippingCostWeight: "1.5000",
        });
      warehouse1Id = wh1.body.data.id;
      warehouse2Id = wh2.body.data.id;
    }

    // Adjust inventory balances: 10 units in warehouse 1, 5 units in warehouse 2
    const adj1 = await request(app)
      .post("/api/v1/inventory/adjustments")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({
        warehouseId: warehouse1Id,
        sku: prodSku,
        deltaQty: "10.000000",
        reason: "Initial stock load for test",
      });
    expect(adj1.status).toBe(201);

    const adj2 = await request(app)
      .post("/api/v1/inventory/adjustments")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({
        warehouseId: warehouse2Id,
        sku: prodSku,
        deltaQty: "5.000000",
        reason: "Secondary stock load for test",
      });
    expect(adj2.status).toBe(201);
  }, 60000);

  it("fails to convert draft quote into order (422 Unprocessable)", async () => {
    // Create draft quote
    const q = await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ customerId, currency: "USD" });
    expect(q.status).toBe(201);
    const qid = q.body.data.id;

    // Attempt conversion
    const conv = await request(app)
      .post(`/api/v1/quotes/${qid}/convert-to-order`)
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(conv.status).toBe(422);
    expect(conv.body.error.code).toBe("UNPROCESSABLE");
  });

  it("converts approved quote to order idempotently and snapshots lines", async () => {
    // 1. Create quote
    const q = await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ customerId, currency: "USD" });
    expect(q.status).toBe(201);
    const qid = q.body.data.id;
    const rev1 = q.body.data.revision;

    // 2. Add line with requested quantity 4 and 0% discount (auto-approves internally)
    const lineRes = await request(app)
      .post(`/api/v1/quotes/${qid}/lines`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev1}"`)
      .send({
        productId: prodId,
        quantity: "4.000000",
        discountPct: "0.00",
        billingType: "one_time",
      });
    expect(lineRes.status).toBe(201);
    const rev2 = lineRes.body.data.revision;

    // 3. Submit quote (0% discount auto-approves -> status 'approvedInternal')
    const subRes = await request(app)
      .post(`/api/v1/quotes/${qid}/submit`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev2}"`)
      .send({});
    expect(subRes.status).toBe(200);
    expect(subRes.body.data.quote.status).toBe("approvedInternal");

    // 4. Convert quote to order
    const conv1 = await request(app)
      .post(`/api/v1/quotes/${qid}/convert-to-order`)
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(conv1.status).toBe(201);
    expect(conv1.body.order.status).toBe("orderCreated");
    expect(conv1.body.order.quoteId).toBe(qid);
    expect(conv1.body.lines).toHaveLength(1);
    expect(conv1.body.lines[0].snapshotSku).toBe(prodSku);
    expect(Number(conv1.body.lines[0].quantity)).toBe(4);

    const orderId = conv1.body.order.id;

    // 5. Duplicate conversion retry returns identical order idempotently (200 OK)
    const conv2 = await request(app)
      .post(`/api/v1/quotes/${qid}/convert-to-order`)
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(conv2.status).toBe(200);
    expect(conv2.body.order.id).toBe(orderId);
    expect(conv2.body.isExisting).toBe(true);

    // 6. Preview fulfillment allocation (pure optimizer - does not change inventory)
    const prevRes = await request(app)
      .post(`/api/v1/orders/${orderId}/fulfillment-plans/preview`)
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(prevRes.status).toBe(200);
    expect(prevRes.body.preview.estimatedShipments).toBe(1);
    expect(prevRes.body.preview.allocations[0].warehouseId).toBe(warehouse1Id);
    expect(Number(prevRes.body.preview.allocations[0].allocatedQty)).toBe(4);

    // 7. Allocation confirmation requires valid If-Match
    const confFail = await request(app)
      .post(`/api/v1/orders/${orderId}/fulfillment-plans/confirm`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"999"`)
      .send({});
    expect(confFail.status).toBe(412);

    // 8. Confirm allocation with correct revision
    const orderRev = conv1.body.order.revision;
    const confSuccess = await request(app)
      .post(`/api/v1/orders/${orderId}/fulfillment-plans/confirm`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${orderRev}"`)
      .send({});
    expect(confSuccess.status).toBe(200);
    expect(confSuccess.body.order.status).toBe("stockReserved");
    expect(confSuccess.body.reservations).toHaveLength(1);
    expect(Number(confSuccess.body.reservations[0].quantity)).toBe(4);

    const reservationId = confSuccess.body.reservations[0].id;

    // 9. Execute shipment for reserved items
    const shipRes = await request(app)
      .post(`/api/v1/orders/${orderId}/shipments`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({
        warehouseId: warehouse1Id,
        reservationIds: [reservationId],
        carrier: "FedEx",
        trackingNumber: "TRK-12345678",
      });
    expect(shipRes.status).toBe(201);
    expect(shipRes.body.shipment.status).toBe("shipped");
    expect(shipRes.body.order.status).toBe("shipped");

    // 10. Re-fetch order detail
    const getOrder = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(getOrder.status).toBe(200);
    expect(getOrder.body.order.status).toBe("shipped");
    expect(getOrder.body.order.shipments).toHaveLength(1);
    expect(getOrder.body.order.shipments[0].trackingNumber).toBe("TRK-12345678");

    // 11. Tenant isolation: Globex tenant cannot view Acme order (404)
    const globexGet = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set("Authorization", `Bearer ${globexAdmin}`);
    expect(globexGet.status).toBe(404);
  });

  it("handles multi-warehouse split when requested quantity exceeds single warehouse capacity", async () => {
    // WH1 had 10, shipped 4 -> 6 remaining.
    // WH2 has 5.
    // Request 8 units (exceeds WH1's 6, requires WH1: 6 + WH2: 2 = 8).
    const q = await request(app)
      .post("/api/v1/quotes")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ customerId, currency: "USD" });
    const qid = q.body.data.id;
    const rev1 = q.body.data.revision;

    const lineRes = await request(app)
      .post(`/api/v1/quotes/${qid}/lines`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev1}"`)
      .send({
        productId: prodId,
        quantity: "8.000000",
        discountPct: "0.00",
        billingType: "one_time",
      });
    const rev2 = lineRes.body.data.revision;

    const subRes = await request(app)
      .post(`/api/v1/quotes/${qid}/submit`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${rev2}"`)
      .send({});
    expect(subRes.status).toBe(200);

    const conv = await request(app)
      .post(`/api/v1/quotes/${qid}/convert-to-order`)
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(conv.status).toBe(201);
    const orderId = conv.body.order.id;

    const prev = await request(app)
      .post(`/api/v1/orders/${orderId}/fulfillment-plans/preview`)
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(prev.status).toBe(200);
    // Needs 2 warehouses (6 from WH1, 2 from WH2)
    expect(prev.body.preview.estimatedShipments).toBe(2);
    expect(prev.body.preview.backorders).toHaveLength(0);
    expect(prev.body.preview.allocations).toHaveLength(2);
  });
});
