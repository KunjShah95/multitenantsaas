import { Router } from "express";
import { db, now, logAudit } from "../utils/db.js";
import { auth, requireRole } from "../middleware/auth.js";
import { healthReport, repDiscountStats } from "../services/health.service.js";
import { buildSchedule } from "../services/billing.service.js";
import { quoteTotals } from "./quotes.js";

// Minimal valid single-page PDF (no dependency): title + text rows.
function pdfBuffer(title, rows) {
  const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").slice(0, 140);
  let content = "BT /F1 11 Tf 40 770 Td 15 TL ";
  for (const ln of [title, "", ...rows].slice(0, 48)) content += `(${esc(ln)}) Tj T* `;
  content += "ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out);
}
const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function xlsBuffer(headers, rows) {
  const cell = (v, t) => `<Cell><Data ss:Type="${t}">${xmlEsc(v)}</Data></Cell>`;
  const num = (v) => (typeof v === "number" ? "Number" : "String");
  let xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Quotes"><Table>`;
  xml += `<Row>${headers.map((h) => cell(h, "String")).join("")}</Row>`;
  for (const row of rows) xml += `<Row>${row.map((v) => cell(v, num(v))).join("")}</Row>`;
  xml += `</Table></Worksheet></Workbook>`;
  return Buffer.from(xml);
}
function convert(amount, from, to) {
  if (!to || from === to) return amount;
  const rf = db.currencies.get(from)?.rateToUSD ?? 1;
  const rt = db.currencies.get(to)?.rateToUSD ?? 1;
  return Math.round(((amount * rf) / rt) * 100) / 100;
}

const r = Router();
r.use(auth());

r.get("/health", (req, res) => {
  const quotes = [...db.quotes.values()];
  const stats = repDiscountStats(quotes);
  const alerts = healthReport(quotes, { stalledDays: Number(req.query.stalledDays || 7) }, stats);
  res.json({ alerts, repStats: stats });
});

r.post("/nudge/:quoteId", requireRole("admin", "manager", "rep"), (req, res) => {
  const q = db.quotes.get(req.params.quoteId); if (!q) return res.status(404).json({ error: "Not found" });
  q.comments.push({ id: `nudge_${Date.now()}`, by: req.user.id, role: req.user.role, comment: "Automated nudge: please review this deal", at: now() });
  q.updatedAt = now();
  logAudit(req.user.id, "nudge", "quote", q.id, {});
  res.json({ ok: true, quote: q });
});

// Orders + invoices + payments
r.get("/orders", (req, res) => res.json([...db.orders.values()]));
r.get("/orders/:id", (req, res) => {
  const o = db.orders.get(req.params.id); if (!o) return res.status(404).json({ error: "Not found" });
  res.json(o);
});
r.post("/orders/:id/invoice", requireRole("admin", "ops"), (req, res) => {
  const o = db.orders.get(req.params.id); if (!o) return res.status(404).json({ error: "Not found" });
  const sched = o.billing || buildSchedule(o.lines, new Date().toISOString());
  const totals = o.totals || quoteTotals(o.lines, [...db.products.values()]);
  const inv = { id: `inv_${Date.now().toString(36)}`, orderId: o.id, currency: o.currency || "USD", oneTimeTotal: sched.oneTimeTotal, recurring: sched.recurring, subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, grand: totals.grand, status: "unpaid", createdAt: now() };
  db.invoices.set(inv.id, inv);
  res.json(inv);
});
r.post("/invoices/:id/pay", requireRole("admin", "ops"), (req, res) => {
  const inv = db.invoices.get(req.params.id); if (!inv) return res.status(404).json({ error: "Not found" });
  inv.status = "paid"; inv.paidAt = now();
  logAudit(req.user.id, "pay", "invoice", inv.id, { amount: inv.oneTimeTotal });
  res.json(inv);
});

// Reports with filters (period / team+rep / approval status / product+category / currency) + export CSV/PDF/XLS
r.get("/reports/quotes", (req, res) => {
  let list = [...db.quotes.values()];
  const { from, to, ownerId, teamId, status, productId, category, currency, convertTo, format } = req.query;
  if (from) list = list.filter((q) => q.createdAt >= from);
  if (to) list = list.filter((q) => q.createdAt <= to);
  if (ownerId) list = list.filter((q) => q.ownerId === ownerId);
  if (teamId) list = list.filter((q) => db.users.get(q.ownerId)?.teamId === teamId);
  if (status) list = list.filter((q) => q.status === status);
  if (currency) list = list.filter((q) => q.currency === currency);
  if (productId) list = list.filter((q) => q.lines.some((l) => l.productId === productId));
  if (category) list = list.filter((q) => q.lines.some((l) => l.category === category));
  const rows = list.map((q) => {
    const t = quoteTotals(q.lines, [...db.products.values()]);
    const grand = convertTo ? convert(t.grand, q.currency || "USD", convertTo) : t.grand;
    return { id: q.id, customer: q.customerName, status: q.status, disc: q.orderDisc ?? "", risk: q.risk?.score ?? "", lines: q.lines.length, grand, cur: convertTo || q.currency || "USD", updated: q.updatedAt };
  });
  if (format === "csv") {
    res.header("Content-Type", "text/csv");
    return res.send("quoteId,customer,status,orderDisc,riskScore,lines,grand,currency,updatedAt\n" + rows.map((x) => [x.id, `"${x.customer}"`, x.status, x.disc, x.risk, x.lines, x.grand, x.cur, x.updated].join(",")).join("\n"));
  }
  if (format === "pdf") {
    res.header("Content-Type", "application/pdf");
    return res.send(pdfBuffer("DealFlow360 Quote Report", rows.map((x) => `${x.id} | ${x.customer} | ${x.status} | ${x.grand} ${x.cur}`)));
  }
  if (format === "xls") {
    res.header("Content-Type", "application/vnd.ms-excel");
    return res.send(xlsBuffer(["quoteId", "customer", "status", "orderDisc", "risk", "lines", "grand", "currency"], rows.map((x) => [x.id, x.customer, x.status, x.disc, x.risk, x.lines, x.grand, x.cur])));
  }
  res.json(list);
});

r.get("/audit/:entity/:id", (req, res) => {
  const rows = [...db.auditLog.values()].filter((a) => a.entity === req.params.entity && a.entityId === req.params.id);
  res.json(rows);
});

export default r;
