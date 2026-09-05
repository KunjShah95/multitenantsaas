import { Router } from "express";
import { db, uid, now, logAudit } from "../utils/db.js";
import { auth } from "../middleware/auth.js";
import { evaluateQuote } from "../services/risk.service.js";

const r = Router();
// Customer portal is a SEPARATE restricted view: role customer can only see own quotes.
r.use(auth());

function reeval(q) {
  const cust = [...db.customers.values()].find((c) => c.id === q.customerId);
  const tier = cust?.tier || q.customerTier || "Bronze";
  const tierCeiling = [...db.tierCeilings.values()].find((t) => t.tier === tier)?.ceiling ?? 5;
  const cats = Object.fromEntries([...db.categoryCeilings.values()].map((c) => [c.category, c.ceiling]));
  return evaluateQuote(q, { tierCeiling, categoryCeilings: cats, chains: [...db.approvalChains.values()] });
}

r.get("/quotes", (req, res) => {
  if (req.user.role !== "customer") return res.status(403).json({ error: "Customer only" });
  const list = [...db.quotes.values()].filter((q) => q.customerId === req.user.id);
  res.json(list);
});

r.get("/quotes/:id", (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "customer" && q.customerId !== req.user.id) return res.status(403).json({ error: "Not your quote" });
  res.json(q);
});

// Line-level comment / change request + counter discount proposal
r.post("/quotes/:id/negotiate", (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "customer" && q.customerId !== req.user.id) return res.status(403).json({ error: "Not your quote" });
  const { lineId, comment, counterDiscountPct } = req.body || {};
  q.comments.push({ id: uid("cm"), by: req.user.id, role: req.user.role, lineId: lineId || null, comment: comment || "", counterDiscountPct: counterDiscountPct ?? null, at: now() });
  if (lineId && counterDiscountPct != null) {
    const l = q.lines.find((x) => x.id === lineId);
    if (l) l.discountPct = counterDiscountPct; // customer proposal applied as pending terms
  }
  if (q.status === "sent" || q.status === "approved" || q.status === "fulfillment" || q.status === "confirmed") q.status = "negotiation";
  const ev = reeval(q);
  q.risk = ev; q.orderDisc = ev.orderDisc; q.updatedAt = now();
  logAudit(req.user.id, "negotiate", "quote", q.id, { lineId, counterDiscountPct });
  res.json({ quote: q, reApprovalRequired: ev.level !== "NONE" });
});

// Confirm final terms (customer one-click). Re-enters approval if over thresholds.
r.post("/quotes/:id/confirm", (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "customer" && q.customerId !== req.user.id) return res.status(403).json({ error: "Not your quote" });
  const ev = reeval(q);
  if (ev.level === "NONE") { q.status = "confirmed"; }
  else {
    q.status = "pending_approval";
    q.approvals = ev.steps.map((s) => ({ ...s, at: null }));
  }
  q.updatedAt = now();
  logAudit(req.user.id, "portal-confirm", "quote", q.id, { risk: ev });
  res.json(q);
});

// Rep sends quote to portal
r.post("/quotes/:id/send", (req, res) => {
  const q = db.quotes.get(req.params.id); if (!q) return res.status(404).json({ error: "Not found" });
  q.status = "sent"; q.updatedAt = now();
  logAudit(req.user.id, "send-to-portal", "quote", q.id, {});
  res.json(q);
});

export default r;
