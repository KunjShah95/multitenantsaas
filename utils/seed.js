import { db, uid, now } from "../utils/db.js";
import { hash } from "../utils/crypto.js";

export function seed() {
  if (db.products.size) return;
  // Teams
  const tA = { id: "team_alpha", name: "Alpha", memberIds: [], createdAt: now() };
  const tB = { id: "team_beta", name: "Beta", memberIds: [], createdAt: now() };
  db.teams.set(tA.id, tA); db.teams.set(tB.id, tB);

  const admin = { id: uid("u"), email: "admin@dealflow.io", pass: hash("admin123"), role: "admin", name: "Admin", teamId: tA.id, createdAt: now() };
  const rep = { id: uid("u"), email: "rep@dealflow.io", pass: hash("rep123"), role: "rep", name: "Rita Rep", teamId: tA.id, createdAt: now() };
  const rep2 = { id: uid("u"), email: "rep2@dealflow.io", pass: hash("rep123"), role: "rep", name: "Raj Rep", teamId: tB.id, createdAt: now() };
  const mgr = { id: uid("u"), email: "manager@dealflow.io", pass: hash("mgr123"), role: "manager", name: "Mona Manager", teamId: tA.id, createdAt: now() };
  const fin = { id: uid("u"), email: "finance@dealflow.io", pass: hash("fin123"), role: "finance", name: "Finn Finance", teamId: tA.id, createdAt: now() };
  const ops = { id: uid("u"), email: "ops@dealflow.io", pass: hash("ops123"), role: "ops", name: "Omar Ops", teamId: tA.id, createdAt: now() };
  for (const u of [admin, rep, rep2, mgr, fin, ops]) db.users.set(u.id, u);
  tA.memberIds = [admin.id, rep.id, mgr.id, fin.id, ops.id];
  tB.memberIds = [rep2.id];

  const cust = { id: uid("c"), email: "buyer@acme.com", pass: hash("cust123"), name: "Acme Corp", tier: "Gold", currency: "USD", createdAt: now() };
  db.customers.set(cust.id, cust);

  const P = [
    { id: "p_laptop", name: "Laptop Pro 15", category: "Hardware", price: 1200, unitCost: 800, unit: "ea", tax: 18,
      variants: [
        { id: "v_8gb", attribute: "RAM", value: "8GB", extraPrice: 0 },
        { id: "v_16gb", attribute: "RAM", value: "16GB", extraPrice: 150 },
      ] },
    { id: "p_setup", name: "Setup Service", category: "Services", price: 500, unitCost: 400, unit: "lot", tax: 18, variants: [] },
    { id: "p_support", name: "Support Plan", category: "Subscriptions", price: 99, unitCost: 20, unit: "mo", tax: 18, variants: [] },
    { id: "p_mouse", name: "Wireless Mouse", category: "Hardware", price: 40, unitCost: 15, unit: "ea", tax: 18,
      variants: [{ id: "v_pack3", attribute: "Pack", value: "Pack of 3", extraPrice: 70 }] },
  ];
  for (const p of P) db.products.set(p.id, p);
  db.priceLists.set("pl1", { id: "pl1", name: "Gold USD", tier: "Gold", currency: "USD", rules: [{ productId: "p_laptop", price: 1150 }] });
  db.priceLists.set("pl2", { id: "pl2", name: "Gold EUR", tier: "Gold", currency: "EUR", rules: [{ productId: "p_laptop", price: 1050 }] });
  db.currencies.set("USD", { code: "USD", rateToUSD: 1 });
  db.currencies.set("EUR", { code: "EUR", rateToUSD: 1.08 });
  db.tierCeilings.set("t1", { tier: "Bronze", ceiling: 5 });
  db.tierCeilings.set("t2", { tier: "Silver", ceiling: 10 });
  db.tierCeilings.set("t3", { tier: "Gold", ceiling: 15 });
  db.categoryCeilings.set("c1", { category: "Hardware", ceiling: 15 });
  db.categoryCeilings.set("c2", { category: "Services", ceiling: 10 });
  db.categoryCeilings.set("c3", { category: "Subscriptions", ceiling: 20 });
  db.approvalChains.set("a1", { id: "a1", name: "Default", managerUpTo: 5, note: "score 0-5 manager, >5 manager+finance", enabled: true });
  db.warehouses.set("w_main", { id: "w_main", name: "Main Warehouse", shippingCostWeight: 1, stock: { p_laptop: 10, p_mouse: 100, p_setup: 9999, p_support: 9999 }, replenishment: "weekly" });
  db.warehouses.set("w_east", { id: "w_east", name: "East Depot", shippingCostWeight: 2, stock: { p_laptop: 3, p_mouse: 20 }, replenishment: "biweekly" });
  db.plans.set("plan_m", { id: "plan_m", name: "Monthly", cycle: "monthly", proration: "daily", refund: "pro-rata" });
  db.plans.set("plan_y", { id: "plan_y", name: "Yearly", cycle: "yearly", proration: "daily", refund: "pro-rata" });
  db.upsellRules.set("u1", { id: "u1", triggerProductId: "p_laptop", suggestedProductId: "p_mouse", weight: 4, promoted: true, minMarginPct: 20 });
  db.upsellRules.set("u2", { id: "u2", triggerProductId: "p_laptop", suggestedProductId: "p_support", weight: 3, promoted: false, minMarginPct: 10 });
}
