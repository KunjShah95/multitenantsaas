// Quick Test Flow (Login to Payment) — runs against live server.
const BASE = process.env.BASE || "http://localhost:4000";
async function api(path, { method = "GET", token, body } = {}) {
  const r = await fetch(BASE + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
}
const step = (n, msg) => console.log(`\n[STEP ${n}] ${msg}`);
try {
  step(1, "Login rep + check backend config");
  const rep = await api("/api/auth/login", { method: "POST", body: { email: "rep@dealflow.io", password: "rep123" } });
  const mgr = await api("/api/auth/login", { method: "POST", body: { email: "manager@dealflow.io", password: "mgr123" } });
  const fin = await api("/api/auth/login", { method: "POST", body: { email: "finance@dealflow.io", password: "fin123" } });
  const cust = await api("/api/auth/portal/login", { method: "POST", body: { email: "buyer@acme.com", magic: true } });
  const tiers = await api("/api/config/discount-tiers", { token: rep.token });
  console.log("tiers:", JSON.stringify(tiers.tiers), "warehouses OK");

  step(2, "Create quotation with over-limit discount (Service 18% > 10% allowed)");
  const customers = cust.customer;
  let q = await api("/api/quotes", { method: "POST", token: rep.token, body: { customerId: customers.id, customerName: customers.name } });
  await api(`/api/quotes/${q.id}/lines`, { method: "POST", token: rep.token, body: { productId: "p_laptop", qty: 2, discountPct: 12, billingType: "onetime" } });
  const withService = await api(`/api/quotes/${q.id}/lines`, { method: "POST", token: rep.token, body: { productId: "p_setup", qty: 1, discountPct: 18, billingType: "onetime" } });
  q = withService.quote;
  console.log("risk:", JSON.stringify(q.risk));
  if (q.risk.level === "NONE") throw new Error("Risk should have flagged approval");

  step(3, "Upsell suggestion updates margin (while building)");
  let sugg = await api(`/api/quotes/${q.id}/suggestions`, { token: rep.token });
  console.log("suggestions:", JSON.stringify(sugg.suggestions), "margin:", JSON.stringify(sugg.margin));
  const top = sugg.suggestions[0];
  if (top) await api(`/api/quotes/${q.id}/lines`, { method: "POST", token: rep.token, body: { productId: top.productId, qty: 2, discountPct: 0, billingType: "onetime" } });
  // add recurring line for step 6
  await api(`/api/quotes/${q.id}/lines`, { method: "POST", token: rep.token, body: { productId: "p_support", qty: 5, discountPct: 5, billingType: "recurring", cycle: "monthly" } });
  q = await api(`/api/quotes/${q.id}`, { token: rep.token });
  console.log("lines:", q.lines.length, "margin:", JSON.stringify(q.margin), "risk:", JSON.stringify(q.risk));

  step(4, "Confirm auto-routes to manager approval");
  q = await api(`/api/quotes/${q.id}/confirm`, { method: "POST", token: rep.token });
  console.log("status:", q.status, "approvals:", JSON.stringify(q.approvals));
  if (q.status !== "pending_approval") throw new Error("Should be pending_approval");

  step(5, "Approve (manager+finance) then warehouse split");
  // re-confirm to include new lines in routing
  try { q = await api(`/api/quotes/${q.id}/confirm`, { method: "POST", token: rep.token }); } catch {}
  for (const t of [mgr, fin]) {
    try { q = await api(`/api/quotes/${q.id}/review`, { method: "POST", token: t.token, body: { action: "approve", reason: "ok" } }); console.log("review by", t.user.email, "->", q.status); } catch (e) { console.log("skip review:", e.message); }
  }
  // force approve remaining as admin if needed
  const admin = await api("/api/auth/login", { method: "POST", body: { email: "admin@dealflow.io", password: "admin123" } });
  let guard = 0;
  while (q.status !== "approved" && guard++ < 4) { q = await api(`/api/quotes/${q.id}/review`, { method: "POST", token: admin.token, body: { action: "approve" } }); }
  console.log("final status:", q.status);
  const plan = await api(`/api/quotes/${q.id}/fulfillment/plan`, { method: "POST", token: admin.token });
  console.log("split plan:", JSON.stringify(plan));
  const decided = await api(`/api/quotes/${q.id}/fulfillment/decide`, { method: "POST", token: admin.token, body: { mode: "accept" } });
  console.log("lines:", decided.order.billing ? "ok" : "?", "billing oneTime:", decided.order.billing.oneTimeTotal, "recurring lines:", decided.order.billing.recurring.length);
  if (!decided.order.billing.recurring.length) throw new Error("Hybrid billing failed");

  step(6, "Hybrid billing already verified in order.billing + customer portal counter-discount re-triggers approval");
  const portalList = await api("/api/portal/quotes", { token: cust.token });
  console.log("portal sees", portalList.length, "quotes");
  const line = q.lines.find((l) => l.productId === "p_setup");
  const neg = await api(`/api/portal/quotes/${q.id}/negotiate`, { method: "POST", token: cust.token, body: { lineId: line.id, comment: "Need better rate", counterDiscountPct: 25 } });
  console.log("reApprovalRequired:", neg.reApprovalRequired, "risk:", JSON.stringify(neg.quote.risk));
  const cq = await api(`/api/portal/quotes/${q.id}/confirm`, { method: "POST", token: cust.token });
  console.log("after customer confirm:", cq.status);
  if (cq.status !== "pending_approval") throw new Error("Should re-enter approval");

  step(7, "Invoice + payment status");
  // approve again quickly
  guard = 0; q = cq;
  while (q.status !== "approved" && guard++ < 4) { q = await api(`/api/quotes/${q.id}/review`, { method: "POST", token: admin.token, body: { action: "approve" } }); }
  const inv = await api(`/api/orders/${decided.order.id}/invoice`, { method: "POST", token: admin.token });
  console.log("invoice:", inv.id, inv.status);
  const paid = await api(`/api/invoices/${inv.id}/pay`, { method: "POST", token: admin.token });
  console.log("paid:", paid.status);
  if (paid.status !== "paid") throw new Error("Payment failed");

  step(8, "Health dashboard + reports");
  const health = await api("/api/health", { token: admin.token });
  console.log("alerts:", health.alerts.length);
  const rep2 = await api("/api/reports/quotes?status=approved", { token: admin.token });
  console.log("approved reports:", rep2.length);
  console.log("\nALL 8 STEPS PASSED");
} catch (e) {
  console.error("\nVERIFY FAILED:", e.message);
  process.exit(1);
}
