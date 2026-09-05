// Verify new gaps: variants, currency, tax, chains CRUD, sub modify, pdf/xls, teams, portal signup.
const BASE = process.env.BASE || "http://localhost:4000";
async function api(path, { method = "GET", token, body, raw } = {}) {
  const r = await fetch(BASE + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) { const buf = Buffer.from(await r.arrayBuffer()); return { status: r.status, headers: [...r.headers.entries()], buf }; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
}
try {
  const admin = await api("/api/auth/login", { method: "POST", body: { email: "admin@dealflow.io", password: "admin123" } });
  const rep = await api("/api/auth/login", { method: "POST", body: { email: "rep@dealflow.io", password: "rep123" } });
  console.log("[1] teams:", JSON.stringify(await api("/api/config/teams", { token: admin.token })));
  console.log("[1] team filter:", JSON.stringify((await api("/api/reports/quotes?teamId=team_alpha", { token: admin.token })).length), "quotes");

  const v = await api("/api/config/products/p_laptop/variants", { method: "POST", token: admin.token, body: { attribute: "RAM", value: "32GB", extraPrice: 300 } });
  console.log("[2] variant created:", JSON.stringify(v));

  const chains0 = await api("/api/config/approval-chains", { token: admin.token });
  const ch = await api("/api/config/approval-chains", { method: "POST", token: admin.token, body: { name: "Strict", managerUpTo: 2 } });
  console.log("[3] chains:", chains0.length, "-> new:", JSON.stringify(ch));
  await api(`/api/config/approval-chains/${ch.id}`, { method: "PATCH", token: admin.token, body: { managerUpTo: 2 } });

  // EUR quote with variant + tax totals
  const cust = await api("/api/auth/portal/login", { method: "POST", body: { email: "buyer@acme.com", magic: true } });
  let q = await api("/api/quotes", { method: "POST", token: rep.token, body: { customerId: cust.customer.id, customerName: "Acme", currency: "EUR" } });
  const added = await api(`/api/quotes/${q.id}/lines`, { method: "POST", token: rep.token, body: { productId: "p_laptop", variantId: "v_16gb", qty: 1, discountPct: 0, billingType: "onetime" } });
  console.log("[4] EUR variant unitPrice (expect 1050+150=1200):", added.quote.lines[0].unitPrice);
  if (added.quote.lines[0].unitPrice !== 1200) throw new Error("Variant/currency pricing wrong");
  const full = await api(`/api/quotes/${q.id}`, { token: rep.token });
  console.log("[4] totals (tax>0):", JSON.stringify(full.totals));
  if (!(full.totals.tax > 0 && full.totals.grand === full.totals.net + full.totals.tax)) throw new Error("Tax totals wrong");
  const bad = await fetch(BASE + `/api/quotes/${q.id}/lines`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + rep.token }, body: JSON.stringify({ productId: "p_laptop", variantId: "nope", qty: 1 }) });
  if (bad.ok) throw new Error("Bad variant should 400");
  console.log("[4] bad variant rejected 400 OK");

  // Recurring modify proration
  await api(`/api/quotes/${q.id}/lines`, { method: "POST", token: rep.token, body: { productId: "p_support", qty: 2, discountPct: 0, billingType: "recurring", cycle: "monthly" } });
  q = await api(`/api/quotes/${q.id}`, { token: rep.token });
  const rl = q.lines.find((l) => l.billingType === "recurring");
  const mod = await api(`/api/quotes/${q.id}/subscriptions/${rl.id}/modify`, { method: "POST", token: rep.token, body: { qty: 5 } });
  console.log("[5] modify delta>0, note:", JSON.stringify({ delta: mod.delta, note: mod.note?.kind }));
  if (!(mod.delta > 0 && mod.note && mod.note.kind === "debit")) throw new Error("Modify proration wrong");

  // Exports
  for (const f of ["csv", "pdf", "xls"]) {
    const r = await api(`/api/reports/quotes?format=${f}`, { token: admin.token, raw: true });
    console.log(`[6] ${f}: status=${r.status} bytes=${r.buf.length} head=${r.buf.slice(0, 5).toString()}`);
    if (f === "pdf" && !r.buf.slice(0, 5).toString().startsWith("%PDF")) throw new Error("Bad PDF");
    if (f === "xls" && !r.buf.toString("utf8", 0, 38).includes("Workbook")) throw new Error("Bad XLS");
  }
  const conv = await api("/api/reports/quotes?convertTo=USD", { token: admin.token });
  console.log("[6] convertTo filter ok, count:", conv.length);

  // Portal signup (unique email per run — data persists across runs)
  const newEmail = `new${Date.now().toString(36)}@buyer.io`;
  const nc = await api("/api/auth/portal/signup", { method: "POST", body: { email: newEmail, password: "pw1234", name: "NewCo", tier: "Silver", currency: "EUR" } });
  console.log("[7] portal signup:", JSON.stringify(nc.customer));
  const pl = await api("/api/auth/portal/login", { method: "POST", body: { email: newEmail, password: "pw1234" } });
  if (!pl.token) throw new Error("Portal login failed");

  // cleanup strict chain so default flow unaffected
  await api(`/api/config/approval-chains/${ch.id}`, { method: "DELETE", token: admin.token });
  console.log("\nNEW GAPS ALL PASSED");
} catch (e) { console.error("\nVERIFY2 FAILED:", e.message); process.exit(1); }
