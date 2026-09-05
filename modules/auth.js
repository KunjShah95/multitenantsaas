import { Router } from "express";
import { z } from "zod";
import { db, uid, now, logAudit } from "../utils/db.js";
import { hash, verify } from "../utils/crypto.js";
import { sign } from "../middleware/auth.js";

const r = Router();
const signupSchema = z.object({ email: z.string().email(), password: z.string().min(4), name: z.string().default("User"), role: z.enum(["admin", "rep", "manager", "finance", "ops"]).default("rep") });

r.post("/signup", (req, res) => {
  const p = signupSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  if ([...db.users.values()].some((u) => u.email === p.data.email)) return res.status(409).json({ error: "Email exists" });
  const u = { id: uid("u"), email: p.data.email, pass: hash(p.data.password), role: p.data.role, name: p.data.name, teamId: req.body.teamId || null, createdAt: now() };
  db.users.set(u.id, u);
  logAudit(u.id, "signup", "user", u.id, {});
  res.json({ token: sign(u), user: { id: u.id, email: u.email, role: u.role, name: u.name, teamId: u.teamId } });
});

r.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const u = [...db.users.values()].find((x) => x.email === email);
  if (!u || !verify(password, u.pass)) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ token: sign(u), user: { id: u.id, email: u.email, role: u.role, name: u.name, teamId: u.teamId } });
});

// Customer portal signup + login (email+password; magic-link simplified: any known customer email + magic:1 issues token)
r.post("/portal/signup", (req, res) => {
  const { email, password, name, tier, currency } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  if ([...db.customers.values()].some((c) => c.email === email)) return res.status(409).json({ error: "Customer exists" });
  const c = { id: uid("c"), email, pass: hash(password), name: name || email, tier: tier || "Bronze", currency: currency || "USD", createdAt: now() };
  db.customers.set(c.id, c);
  logAudit(c.id, "signup", "customer", c.id, {});
  res.json({ token: sign({ id: c.id, role: "customer", email: c.email }), customer: { id: c.id, email: c.email, name: c.name, tier: c.tier, currency: c.currency } });
});
r.post("/portal/login", (req, res) => {
  const { email, password, magic } = req.body || {};
  const c = [...db.customers.values()].find((x) => x.email === email);
  if (!c) return res.status(401).json({ error: "Unknown customer" });
  if (!magic && !verify(password || "", c.pass)) return res.status(401).json({ error: "Invalid credentials" });
  const token = sign({ id: c.id, role: "customer", email: c.email });
  res.json({ token, customer: { id: c.id, email: c.email, name: c.name, tier: c.tier } });
});

export default r;
