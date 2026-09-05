import express from "express";
import cors from "cors";
import { load, persist } from "./utils/db.js";
import { seed } from "./utils/seed.js";
import authRoutes from "./modules/auth.js";
import catalogRoutes from "./modules/catalog.js";
import quoteRoutes from "./modules/quotes.js";
import portalRoutes from "./modules/portal.js";
import opsRoutes from "./modules/ops.js";

await load();
seed();
await persist();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true, app: "DealFlow360", time: new Date().toISOString() }));
app.use("/api/auth", authRoutes);
// architecture map for deliverable (public; must precede auth-guarded /api router)
app.get("/api/architecture", (req, res) => res.json({
  modules: ["auth(+portal signup, teams)", "config(products+variants, pricelists+currency, tiers, chains CRUD, warehouses, plans, upsell)", "quotes(risk routing, tax totals)", "portal(negotiation)", "fulfillment(split)", "billing(hybrid, modify proration)", "health+reports(csv/pdf/xls)"],
  flow: "Quote -> RiskScore -> Approval(manager,finance) -> Fulfillment(split) -> Billing(onetime+recurring) -> Portal(negotiate->re-approval) -> Reports",
  dataModel: ["users(team)", "teams", "customers(tier,currency)", "products(category,price,cost,variants[])", "priceLists(tier,currency,rules)", "currencies(rates)", "tierCeilings", "categoryCeilings", "approvalChains(managerUpTo)", "warehouses(stock,weight)", "plans", "upsellRules", "quotes(lines,risk,approvals,fulfillment,currency)", "orders", "invoices(tax,grand)", "creditNotes(debit/credit)", "auditLog"],
  persistence: "SQLite (data.db, node:sqlite) with JSON backup (data.json)",
}));
app.use("/api/config", catalogRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api", opsRoutes); // /api/health, /api/orders, /api/reports, /api/audit

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: "Server error" }); });

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`DealFlow360 backend on :${PORT}`));
