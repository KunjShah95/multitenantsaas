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

async function convertReadyQuote(
  token: string,
  customerId: string,
  payload: Record<string, unknown>[],
) {
  const q = await request(app)
    .post("/api/v1/quotes")
    .set("Authorization", `Bearer ${token}`)
    .send({ customerId, currency: "USD" });
  expect(q.status).toBe(201);
  const qid = q.body.data.id;
  let rev = q.body.data.revision;

  for (const line of payload) {
    const lineRes = await request(app)
      .post(`/api/v1/quotes/${qid}/lines`)
      .set("Authorization", `Bearer ${token}`)
      .set("If-Match", `W/"${rev}"`)
      .send(line);
    expect(lineRes.status).toBe(201);
    rev = lineRes.body.data.revision;
  }

  const subRes = await request(app)
    .post(`/api/v1/quotes/${qid}/submit`)
    .set("Authorization", `Bearer ${token}`)
    .set("If-Match", `W/"${rev}"`)
    .send({});
  expect(subRes.status).toBe(200);

  const conv = await request(app)
    .post(`/api/v1/quotes/${qid}/convert-to-order`)
    .set("Authorization", `Bearer ${token}`);
  expect([200, 201]).toContain(conv.status);
  return conv.body.order;
}

describe("Phase 8 Subscriptions & Billing", () => {
  let acmeAdmin: string;
  let acmeRep: string;
  let globexAdmin: string;
  let customerId: string;
  let prodId: string;
  let planId: string;
  let warehouseId: string;

  beforeAll(async () => {
    acmeAdmin = await login("alice@acme.test", "DemoPass123!", "acme");
    acmeRep = await login("bob@acme.test", "DemoPass123!", "acme");
    globexAdmin = await login("carol@globex.test", "DemoPass123!", "globex");

    const custRes = await request(app)
      .get("/api/v1/customers")
      .set("Authorization", `Bearer ${acmeAdmin}`);
    customerId = custRes.body.data[0].id;

    const sku = `SKU-P8-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const prodRes = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({
        sku,
        name: "Phase 8 Mixed Item",
        standardPrice: "100.000000",
        standardCost: "40.000000",
        taxRatePct: "10.00",
      });
    expect(prodRes.status).toBe(201);
    prodId = prodRes.body.data.id;

    const plans = await request(app)
      .get("/api/v1/subscription-plans")
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(plans.status).toBe(200);
    planId = plans.body.data[0].id;

    const whRes = await request(app)
      .get("/api/v1/warehouses")
      .set("Authorization", `Bearer ${acmeAdmin}`);
    warehouseId = whRes.body.data[0].id;

    await request(app)
      .post("/api/v1/inventory/adjustments")
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({
        warehouseId,
        sku,
        deltaQty: "20.000000",
        reason: "Phase 8 stock",
      });
  }, 60000);

  it("creates one-time draft invoice and active subscription from a mixed order", async () => {
    const order = await convertReadyQuote(acmeAdmin, customerId, [
      { productId: prodId, quantity: "1.000000", discountPct: "0.00", billingType: "one_time" },
      {
        productId: prodId,
        quantity: "1.000000",
        discountPct: "0.00",
        billingType: "recurring",
        planId,
      },
    ]);

    const invoices = await request(app)
      .get("/api/v1/invoices")
      .query({ orderId: order.id })
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(invoices.status).toBe(200);
    expect(invoices.body.capabilities.automaticCollectionEnabled).toBe(false);
    expect(invoices.body.capabilities.recurringBillingAutomatic).toBe(false);
    expect(invoices.body.invoices).toHaveLength(1);
    expect(invoices.body.invoices[0].invoiceType).toBe("one_time");
    expect(invoices.body.invoices[0].status).toBe("draft");

    const subs = await request(app)
      .get("/api/v1/subscriptions")
      .query({ customerId })
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(subs.status).toBe(200);
    const created = subs.body.subscriptions.filter(
      (s: { orderId: string }) => s.orderId === order.id,
    );
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe("active");
    expect(created[0].billingTimezone).toBe("UTC");

    const retry = await request(app)
      .post(`/api/v1/quotes/${order.quoteId}/convert-to-order`)
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(retry.status).toBe(200);

    const invoices2 = await request(app)
      .get("/api/v1/invoices")
      .query({ orderId: order.id })
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(invoices2.body.invoices).toHaveLength(1);
  });

  it("issues the one-time invoice on first shipment and records a manual payment", async () => {
    const order = await convertReadyQuote(acmeAdmin, customerId, [
      { productId: prodId, quantity: "1.000000", discountPct: "0.00", billingType: "one_time" },
    ]);

    const preview = await request(app)
      .post(`/api/v1/orders/${order.id}/fulfillment-plans/preview`)
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(preview.status).toBe(200);

    const confirm = await request(app)
      .post(`/api/v1/orders/${order.id}/fulfillment-plans/confirm`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${order.revision}"`)
      .send({});
    expect(confirm.status).toBe(200);

    const ship = await request(app)
      .post(`/api/v1/orders/${order.id}/shipments`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ warehouseId, reservationIds: [confirm.body.reservations[0].id] });
    expect(ship.status).toBe(201);

    const list = await request(app)
      .get("/api/v1/invoices")
      .query({ orderId: order.id })
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(list.body.invoices[0].status).toBe("issued");
    const invoiceId = list.body.invoices[0].id;
    const amount = list.body.invoices[0].grandTotal;

    const payForbidden = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/record-payment`)
      .set("Authorization", `Bearer ${acmeRep}`)
      .send({ amount, paidAt: new Date().toISOString(), method: "manual", reference: "CHK-1" });
    expect(payForbidden.status).toBe(403);

    const pay = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/record-payment`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("Idempotency-Key", `pay-${invoiceId}`)
      .send({ amount, paidAt: new Date().toISOString(), method: "manual", reference: "CHK-1" });
    expect(pay.status).toBe(200);
    expect(pay.body.invoice.status).toBe("paid");
    expect(pay.body.invoice.balance).toBe("0.000000");

    const replay = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/record-payment`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("Idempotency-Key", `pay-${invoiceId}`)
      .send({ amount, paidAt: new Date().toISOString(), method: "manual", reference: "CHK-1" });
    expect(replay.status).toBe(200);
    expect(replay.body.payment.id).toBe(pay.body.payment.id);

    const detail = await request(app)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${acmeAdmin}`);
    expect(detail.body.lines.every((l: { immutable: number }) => l.immutable === 1)).toBe(true);
    expect(detail.body.payments).toHaveLength(1);
  });

  it("previews and applies a subscription change with adjustment, then cancels with credit", async () => {
    const order = await convertReadyQuote(acmeAdmin, customerId, [
      {
        productId: prodId,
        quantity: "1.000000",
        discountPct: "0.00",
        billingType: "recurring",
        planId,
      },
    ]);

    const subs = await request(app)
      .get("/api/v1/subscriptions")
      .set("Authorization", `Bearer ${acmeAdmin}`);
    const sub = subs.body.subscriptions.find((s: { orderId: string }) => s.orderId === order.id);
    expect(sub).toBeTruthy();

    const mid = new Date(
      (new Date(sub.currentPeriodStart).getTime() + new Date(sub.currentPeriodEnd).getTime()) / 2,
    );

    const preview = await request(app)
      .post(`/api/v1/subscriptions/${sub.id}/changes/preview`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .send({ quantity: "2.000000", effectiveAt: mid.toISOString() });
    expect(preview.status).toBe(200);
    expect(preview.body.preview.proration.direction).toBe("debit");

    const stale = await request(app)
      .post(`/api/v1/subscriptions/${sub.id}/changes`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"999"`)
      .send({ quantity: "2.000000", effectiveAt: mid.toISOString() });
    expect(stale.status).toBe(412);

    const apply = await request(app)
      .post(`/api/v1/subscriptions/${sub.id}/changes`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${sub.revision}"`)
      .set("Idempotency-Key", `chg-${sub.id}`)
      .send({ quantity: "2.000000", effectiveAt: mid.toISOString() });
    expect(apply.status).toBe(200);
    expect(apply.body.subscription.quantity).toMatch(/^2/);
    expect(apply.body.adjustmentId).toBeTruthy();

    const replay = await request(app)
      .post(`/api/v1/subscriptions/${sub.id}/changes`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${sub.revision}"`)
      .set("Idempotency-Key", `chg-${sub.id}`)
      .send({ quantity: "2.000000", effectiveAt: mid.toISOString() });
    expect(replay.status).toBe(200);
    expect(replay.body.change.id).toBe(apply.body.change.id);

    const cancel = await request(app)
      .post(`/api/v1/subscriptions/${sub.id}/cancel`)
      .set("Authorization", `Bearer ${acmeAdmin}`)
      .set("If-Match", `W/"${apply.body.subscription.revision}"`)
      .set("Idempotency-Key", `can-${sub.id}`)
      .send({ effectiveAt: mid.toISOString(), reason: "Customer requested" });
    expect(cancel.status).toBe(200);
    expect(cancel.body.subscription.status).toBe("cancelled");
    expect(cancel.body.credit.direction).toBe("credit");

    const globex = await request(app)
      .get(`/api/v1/subscriptions/${sub.id}`)
      .set("Authorization", `Bearer ${globexAdmin}`);
    expect(globex.status).toBe(404);
  });
});
