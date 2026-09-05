import { Router } from "express";
import { z } from "zod";
import { db, uid, now, logAudit } from "../utils/db.js";
import { auth, requireRole } from "../middleware/auth.js";
import { evaluateQuote } from "../services/risk.service.js";
import { suggest, quoteMargin } from "../services/upsell.service.js";
import { autoSplit } from "../services/split.service.js";
import { buildSchedule, cancelRefund, modifyProration } from "../services/billing.service.js";

const r = Router();
r.use(auth());

function config() {
  return {
    tierOf: Object.fromEntries([...db.tierCeilings.values()].map((t) => [t.tier, t.ceiling])),
    categoryCeilings: Object.fromEntries([...db.categoryCeilings.values()].map((c) => [c.category, c.ceiling])),
    chains: [...db.approvalChains.values()],
  };
}
function priceFor(product, tier, currency, variantId) {
  const lists = [...db.priceLists.values()];
  const pl = lists.find((x) => x.tier === tier && x.currency === currency)
    || lists.find((x) => x.tier === tier) || null;
  const rule = pl?.rules?.find((x) => x.productId === product.id && (x.variantId || null) === (variantId || null))
    || pl?.rules?.find((x) => x.productId === product.id && !x.variantId);
  const base = rule?.price ?? product.price;
  const variant = (product.variants || []).find((v) => v.id === variantId);
  return { price: base + (variant?.extraPrice || 0), variant: variant || null };
}
export function quoteTotals(lines, products) {
  let gross = 0, net = 0, tax = 0;
  for (const l of lines) {
    const p = products.find((x) => x.id === l.productId);
    const g = (l.qty || 0) * (l.unitPrice || 0);
    const n = g * (1 - (l.discountPct || 0) / 100);
    const rate = l.taxRate ?? p?.tax ?? 0;
    gross += g; net += n; tax += (n * rate) / 100;
  }
  const r2 = (x) => Math.round(x * 100) / 100;
  return { subtotal: r2(gross), discount: r2(gross - net), net: r2(net), tax: r2(tax), grand: r2(net + tax) };
}
function evalAndAttach(q) {
  const cust = db.customers.get(q.customerId);
  const tier = cust?.tier || q.customerTier || "Bronze";
  const c = config();
  const ev = evaluateQuote(q, { tierCeiling: c.tierOf[tier] ?? 5, categoryCeilings: c.categoryCeilings, chains: c.chains });
  q.risk = ev; q.orderDisc = ev.orderDisc;
  return ev;
}

const lineSchema = z.object({
  productId: z.string(), qty: z.number().positive(), discountPct: z.number().min(0).max(100).default(0),
  billingType: z.enum(["onetime", "recurring"]).default("onetime"), cycle: z.enum(["monthly", "quarterly", "yearly"]).default("monthly"),
  variantId: z.string().optional(),
});

// List with filters: period, rep, team, approval status, product/category, currency
r.get("/", (req, res) => {
  let list = [...db.quotes.values()];
  const { from, to, ownerId, teamId, status, productId, category, currency } = req.query;
  if (from) list = list.filter((q) => q.createdAt >= from);
  if (to) list = list.filter((q) => q.createdAt <= to);
  if (ownerId) list = list.filter((q) => q.ownerId === ownerId);
  if (teamId) list = list.filter((q) => db.users.get(q.ownerId)?.teamId === teamId);
  if (status) list = list.filter((q) => q.status === status);
  if (currency) list = list.filter((q) => q.currency === currency);
  if (productId) list = list.filter((q) => q.lines.some((l) => l.productId === productId));
  if (category) list = list.filter((q) => q.lines.some((l) => l.category === category));
  list.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  res.json(list);
});

r.post("/", requireRole("admin", "rep"), (req, res) => {
  const { customerId, customerName, customerTier, currency } = req.body;
  const cust = db.customers.get(customerId);
  const q = {
    id: uid("q"), ownerId: req.user.id, customerId, customerName: customerName || "Unnamed",
    customerTier: customerTier || cust?.tier || "Bronze",
    currency: currency || cust?.currency || "USD",
    lines: [], status: "draft", approvals: [], comments: [],
    createdAt: now(), updatedAt: now(),
  };
  evalAndAttach(q);
  db.quotes.set(q.id, q);
  logAudit(req.user.id, "create", "quote", q.id, {});
  res.json(q);
});

r.get("/:id", (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  const margin = quoteMargin(q.lines, [...db.products.values()]);
  res.json({ ...q, margin, totals: quoteTotals(q.lines, [...db.products.values()]) });
});

// Add/update lines: applies tier price, recomputes risk, auto-routes
r.post("/:id/lines", requireRole("admin", "rep"), (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  if (!["draft", "revision", "negotiation"].includes(q.status)) return res.status(400).json({ error: `Cannot edit in status ${q.status}` });
  const p = lineSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const prod = db.products.get(p.data.productId); if (!prod) return res.status(404).json({ error: "No product" });
  if (p.data.variantId && !(prod.variants || []).some((v) => v.id === p.data.variantId)) {
    return res.status(400).json({ error: "Unknown variant for product" });
  }
  const priced = priceFor(prod, q.customerTier, q.currency, p.data.variantId);
  const line = {
    id: uid("l"), productId: prod.id, category: prod.category, name: prod.name,
    variantId: p.data.variantId || null, variantLabel: priced.variant ? `${priced.variant.attribute}:${priced.variant.value}` : null,
    qty: p.data.qty, unitPrice: priced.price, taxRate: prod.tax ?? 0, discountPct: p.data.discountPct,
    billingType: p.data.billingType, cycle: p.data.cycle,
  };
  q.lines.push(line);
  const ev = evalAndAttach(q);
  q.updatedAt = now();
  logAudit(req.user.id, "add-line", "quote", q.id, { line });
  const margin = quoteMargin(q.lines, [...db.products.values()]);
  res.json({ quote: q, margin, suggestions: suggest(q.lines, [...db.products.values()], [...db.upsellRules.values()], 15) });
});

r.patch("/:id/lines/:lid", requireRole("admin", "rep"), (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  const l = q.lines.find((x) => x.id === req.params.lid); if (!l) return res.status(404).json({ error: "No line" });
  Object.assign(l, req.body);
  evalAndAttach(q); q.updatedAt = now();
  logAudit(req.user.id, "edit-line", "quote", q.id, { lid: l.id });
  res.json(q);
});

// Live upsell suggestions + margin impact
r.get("/:id/suggestions", (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  res.json({ suggestions: suggest(q.lines, [...db.products.values()], [...db.upsellRules.values()], 15), margin: quoteMargin(q.lines, [...db.products.values()]) });
});

// Confirm -> auto route for approval or straight to fulfillment
r.post("/:id/confirm", requireRole("admin", "rep"), (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  const ev = evalAndAttach(q);
  if (ev.level === "NONE") {
    q.status = "approved"; q.approvals = [{ role: "system", status: "approved", at: now(), note: "Auto-approved: within thresholds" }];
  } else {
    q.status = "pending_approval";
    q.approvals = ev.steps.map((s) => ({ ...s, at: null }));
  }
  q.updatedAt = now();
  logAudit(req.user.id, "confirm", "quote", q.id, { risk: ev });
  res.json(q);
});

// Approval actions
r.post("/:id/review", requireRole("manager", "finance", "admin"), (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  const { action, reason } = req.body; // approve | reject | return
  if (!["approve", "reject", "return"].includes(action)) return res.status(400).json({ error: "Bad action" });
  const step = q.approvals.find((s) => s.role === req.user.role && s.status === "pending")
    || (req.user.role === "admin" && q.approvals.find((s) => s.status === "pending"));
  if (!step && q.status !== "pending_approval") return res.status(400).json({ error: "Nothing to review" });
  if (action === "approve") {
    if (step) { step.status = "approved"; step.at = now(); step.by = req.user.id; step.reason = reason || ""; }
    if (q.approvals.every((s) => s.status === "approved")) q.status = "approved";
  } else if (action === "reject") {
    if (step) { step.status = "rejected"; step.at = now(); step.by = req.user.id; step.reason = reason || ""; }
    q.status = "rejected";
  } else {
    q.status = "revision";
    if (step) { step.status = "returned"; step.at = now(); step.by = req.user.id; step.reason = reason || ""; }
  }
  q.updatedAt = now();
  logAudit(req.user.id, `review:${action}`, "quote", q.id, { reason });
  res.json(q);
});

// Fulfillment split suggestion + accept/override
r.post("/:id/fulfillment/plan", requireRole("admin", "rep", "ops"), (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  if (q.status !== "approved") return res.status(400).json({ error: "Quote must be approved first" });
  const plan = autoSplit(q.lines.map((l) => ({ productId: l.productId, qty: l.qty })), [...db.warehouses.values()]);
  q.fulfillment = { plan, decided: null, status: "planned" };
  q.updatedAt = now();
  res.json(plan);
});
r.post("/:id/fulfillment/decide", requireRole("admin", "ops", "rep"), (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  const { mode, allocations } = req.body; // accept | override
  if (mode === "override" && allocations) q.fulfillment = { ...q.fulfillment, decided: allocations, status: "decided-override" };
  else q.fulfillment = { ...q.fulfillment, decided: q.fulfillment.plan.allocations, status: "decided" };
  // decrement stock
  for (const a of q.fulfillment.decided || []) {
    const w = db.warehouses.get(a.warehouseId);
    if (w?.stock?.[a.productId] != null) w.stock[a.productId] = Math.max(0, w.stock[a.productId] - a.qty);
  }
  q.status = "fulfillment"; q.updatedAt = now();
  // create order + billing schedule (hybrid, with tax totals)
  const schedule = buildSchedule(q.lines, new Date().toISOString());
  const totals = quoteTotals(q.lines, [...db.products.values()]);
  const order = { id: uid("o"), quoteId: q.id, lines: q.lines, fulfillment: q.fulfillment, billing: schedule, totals, currency: q.currency, status: "open", createdAt: now() };
  db.orders.set(order.id, order);
  logAudit(req.user.id, `fulfill:${mode}`, "quote", q.id, {});
  res.json({ quote: q, order });
});
r.post("/:id/fulfillment/consolidate", requireRole("admin", "ops"), (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  const plan = autoSplit(q.fulfillment?.plan?.backorder || [], [...db.warehouses.values()]);
  q.fulfillment.backorderConsolidation = plan; q.updatedAt = now();
  res.json(plan);
});

// Subscription modify (mid-cycle qty/cycle/discount change) with prorated delta + debit/credit note
r.post("/:id/subscriptions/:lid/modify", requireRole("admin", "rep", "ops"), (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  const l = q.lines.find((x) => x.id === req.params.lid); if (!l) return res.status(404).json({ error: "No line" });
  if (l.billingType !== "recurring") return res.status(400).json({ error: "Line is not recurring" });
  const { qty, cycle, discountPct } = req.body || {};
  const changes = {};
  if (qty != null) { if (qty <= 0) return res.status(400).json({ error: "qty must be positive" }); changes.qty = qty; }
  if (cycle != null) { if (!["monthly", "quarterly", "yearly"].includes(cycle)) return res.status(400).json({ error: "Bad cycle" }); changes.cycle = cycle; }
  if (discountPct != null) { if (discountPct < 0 || discountPct > 100) return res.status(400).json({ error: "Bad discount" }); changes.discountPct = discountPct; }
  const calc = modifyProration(l, changes, q.createdAt, new Date().toISOString());
  Object.assign(l, changes);
  evalAndAttach(q); q.updatedAt = now();
  let note = null;
  if (calc.delta !== 0) {
    note = { id: uid(calc.delta > 0 ? "dn" : "cn"), quoteId: q.id, lineId: l.id, amount: Math.abs(calc.delta), kind: calc.delta > 0 ? "debit" : "credit", reason: "mid-cycle modification proration", createdAt: now(), by: req.user.id };
    db.creditNotes.set(note.id, note);
  }
  logAudit(req.user.id, "sub-modify", "quote", q.id, { delta: calc.delta });
  res.json({ delta: calc.delta, newPerCycle: calc.newPerCycle, remainingDays: calc.remainingDays, line: l, note, quote: q });
});

// Subscription modify/cancel with credit note
r.post("/:id/subscriptions/:lid/cancel", requireRole("admin", "rep", "ops"), (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  const l = q.lines.find((x) => x.id === req.params.lid); if (!l) return res.status(404).json({ error: "No line" });
  const refund = cancelRefund(l, q.createdAt, new Date().toISOString());
  const cn = { id: uid("cn"), quoteId: q.id, lineId: l.id, amount: refund, createdAt: now(), by: req.user.id };
  db.creditNotes.set(cn.id, cn);
  l.cancelled = true;
  logAudit(req.user.id, "sub-cancel", "quote", q.id, { refund });
  res.json({ refund, creditNote: cn });
});

export default r;
