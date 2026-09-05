import { Router } from "express";
import { db, uid, now, logAudit } from "../utils/db.js";
import { auth, requireRole } from "../middleware/auth.js";

const r = Router();
r.use(auth());

// ---- Products (+ variants) ----
r.get("/products", (req, res) => res.json([...db.products.values()]));
r.post("/products", requireRole("admin"), (req, res) => {
  const p = { id: req.body.id || uid("p"), variants: [], ...req.body };
  db.products.set(p.id, p); logAudit(req.user.id, "upsert", "product", p.id, {});
  res.json(p);
});
r.post("/products/:id/variants", requireRole("admin"), (req, res) => {
  const p = db.products.get(req.params.id); if (!p) return res.status(404).json({ error: "No product" });
  const { attribute, value, extraPrice } = req.body || {};
  if (!attribute || !value) return res.status(400).json({ error: "attribute and value required" });
  const v = { id: req.body.id || uid("v"), attribute, value, extraPrice: Number(extraPrice || 0) };
  p.variants = p.variants || []; p.variants.push(v);
  logAudit(req.user.id, "add-variant", "product", p.id, { v });
  res.json(v);
});
r.delete("/products/:id/variants/:vid", requireRole("admin"), (req, res) => {
  const p = db.products.get(req.params.id); if (!p) return res.status(404).json({ error: "No product" });
  p.variants = (p.variants || []).filter((v) => v.id !== req.params.vid);
  res.json({ ok: true });
});
// ---- Currencies (currency-specific pricing rules resolve via priceLists; rates convert reports) ----
r.get("/currencies", (req, res) => res.json([...db.currencies.values()]));
r.post("/currencies", requireRole("admin"), (req, res) => {
  const { code, rateToUSD } = req.body || {};
  if (!code || rateToUSD == null) return res.status(400).json({ error: "code and rateToUSD required" });
  const c = { code, rateToUSD: Number(rateToUSD) }; db.currencies.set(code, c); res.json(c);
});
// ---- Teams ----
r.get("/teams", (req, res) => res.json([...db.teams.values()]));
r.post("/teams", requireRole("admin", "manager"), (req, res) => {
  const t = { id: req.body.id || uid("t"), name: req.body.name || "Team", memberIds: req.body.memberIds || [], createdAt: now() };
  db.teams.set(t.id, t); res.json(t);
});
r.post("/teams/:id/members", requireRole("admin", "manager"), (req, res) => {
  const t = db.teams.get(req.params.id); if (!t) return res.status(404).json({ error: "No team" });
  const { userId } = req.body || {};
  const u = db.users.get(userId); if (!u) return res.status(404).json({ error: "No user" });
  if (!t.memberIds.includes(userId)) t.memberIds.push(userId);
  u.teamId = t.id;
  res.json(t);
});
// ---- Price lists ----
r.get("/pricelists", (req, res) => res.json([...db.priceLists.values()]));
r.post("/pricelists", requireRole("admin"), (req, res) => {
  const pl = { id: uid("pl"), ...req.body }; db.priceLists.set(pl.id, pl); res.json(pl);
});
// ---- Discount tiers / category ceilings / approval chains (CRUD) ----
r.get("/discount-tiers", (req, res) => res.json({ tiers: [...db.tierCeilings.values()], categories: [...db.categoryCeilings.values()], chains: [...db.approvalChains.values()] }));
r.post("/discount-tiers", requireRole("admin", "manager"), (req, res) => {
  const { tier, ceiling } = req.body; const row = { tier, ceiling };
  db.tierCeilings.set(tier, row); logAudit(req.user.id, "config", "tier", tier, row); res.json(row);
});
r.post("/category-ceilings", requireRole("admin", "manager"), (req, res) => {
  const { category, ceiling } = req.body; const row = { category, ceiling };
  db.categoryCeilings.set(category, row); res.json(row);
});
r.get("/approval-chains", (req, res) => res.json([...db.approvalChains.values()]));
r.post("/approval-chains", requireRole("admin", "manager"), (req, res) => {
  const c = { id: req.body.id || uid("a"), name: req.body.name || "Chain", managerUpTo: Number(req.body.managerUpTo ?? 5), note: req.body.note || "", enabled: req.body.enabled !== false };
  db.approvalChains.set(c.id, c); logAudit(req.user.id, "upsert", "approvalChain", c.id, {});
  res.json(c);
});
r.patch("/approval-chains/:id", requireRole("admin", "manager"), (req, res) => {
  const c = db.approvalChains.get(req.params.id); if (!c) return res.status(404).json({ error: "No chain" });
  Object.assign(c, req.body);
  res.json(c);
});
r.delete("/approval-chains/:id", requireRole("admin"), (req, res) => { db.approvalChains.delete(req.params.id); res.json({ ok: true }); });
// ---- Warehouses ----
r.get("/warehouses", (req, res) => res.json([...db.warehouses.values()]));
r.post("/warehouses", requireRole("admin", "ops"), (req, res) => {
  const w = { id: req.body.id || uid("w"), stock: {}, shippingCostWeight: 1, ...req.body };
  db.warehouses.set(w.id, w); logAudit(req.user.id, "upsert", "warehouse", w.id, {}); res.json(w);
});
r.post("/warehouses/:id/stock", requireRole("admin", "ops"), (req, res) => {
  const w = db.warehouses.get(req.params.id); if (!w) return res.status(404).json({ error: "No warehouse" });
  Object.assign(w.stock, req.body.stock || {}); res.json(w);
});
// ---- Subscription plans ----
r.get("/plans", (req, res) => res.json([...db.plans.values()]));
r.post("/plans", requireRole("admin"), (req, res) => {
  const pl = { id: uid("plan"), ...req.body }; db.plans.set(pl.id, pl); res.json(pl);
});
// ---- Upsell rules ----
r.get("/upsell-rules", (req, res) => res.json([...db.upsellRules.values()]));
r.post("/upsell-rules", requireRole("admin", "manager"), (req, res) => {
  const rule = { id: uid("ur"), ...req.body }; db.upsellRules.set(rule.id, rule); res.json(rule);
});
r.delete("/upsell-rules/:id", requireRole("admin"), (req, res) => { db.upsellRules.delete(req.params.id); res.json({ ok: true }); });

export default r;
