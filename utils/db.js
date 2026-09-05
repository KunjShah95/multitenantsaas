import fs from "node:fs";
import path from "node:path";

const DATA_FILE = path.join(process.cwd(), "data.json");
const SQLITE_FILE = path.join(process.cwd(), "data.db");

const collections = [
  "users", "teams", "customers", "products", "priceLists", "currencies",
  "tierCeilings", "categoryCeilings", "approvalChains",
  "warehouses", "plans", "upsellRules",
  "quotes", "orders", "invoices", "creditNotes", "auditLog",
];

export const db = {};
for (const c of collections) db[c] = new Map();
let seq = 1;

// ---- SQLite persistence (real DB) with JSON backup ----
// Table: store(collection TEXT, id TEXT, data TEXT, PRIMARY KEY(collection,id)) + meta(key,value)
let sql = null;
async function openSql() {
  if (sql !== undefined && sql !== null) return sql;
  try {
    const mod = await import("node:sqlite");
    const DatabaseSync = mod.DatabaseSync;
    sql = new DatabaseSync(SQLITE_FILE);
    sql.exec(`CREATE TABLE IF NOT EXISTS store(collection TEXT, id TEXT, data TEXT, PRIMARY KEY(collection,id));
              CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);`);
  } catch {
    sql = false; // fallback to JSON only
  }
  return sql;
}

function snapshot() {
  const out = { _seq: seq };
  for (const c of collections) out[c] = [...db[c].values()];
  return out;
}
function restore(data) {
  for (const c of collections) {
    db[c].clear();
    for (const row of data[c] || []) db[c].set(row.id ?? row.tier ?? row.category, row);
  }
  if (data._seq) seq = data._seq;
}
export async function persist() {
  const snap = snapshot();
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(snap, null, 2)); } catch {}
  try {
    const s = await openSql();
    if (s) {
      const put = s.prepare(`INSERT OR REPLACE INTO store(collection,id,data) VALUES(?,?,?)`);
      const del = s.prepare(`DELETE FROM store WHERE collection=? AND id NOT IN (SELECT value FROM json_each(?))`);
      for (const c of collections) {
        const rows = snap[c] || [];
        const ids = rows.map((x) => String(x.id ?? x.tier ?? x.category));
        for (const row of rows) put.run(c, String(row.id ?? row.tier ?? row.category), JSON.stringify(row));
        if (ids.length) del.run(c, JSON.stringify(ids));
      }
      s.prepare(`INSERT OR REPLACE INTO meta(key,value) VALUES('seq',?)`).run(String(seq));
    }
  } catch {}
}
export async function load() {
  // Try SQLite first
  try {
    const s = await openSql();
    if (s) {
      const cnt = s.prepare(`SELECT COUNT(*) as n FROM store`).get()?.n || 0;
      if (cnt > 0) {
        const data = {};
        for (const c of collections) {
          data[c] = s.prepare(`SELECT data FROM store WHERE collection=?`).all(c).map((x) => JSON.parse(x.data));
        }
        data._seq = Number(s.prepare(`SELECT value FROM meta WHERE key='seq'`).get()?.value || 1);
        restore(data);
        return;
      }
    }
  } catch {}
  try {
    if (fs.existsSync(DATA_FILE)) restore(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
  } catch {}
}
setInterval(() => { persist(); }, 15000);

export function uid(prefix = "id") {
  return `${prefix}_${(seq++).toString(36)}${Date.now().toString(36).slice(-4)}`;
}
export function now() { return new Date().toISOString(); }
export function logAudit(actor, action, entity, entityId, detail = {}) {
  const entry = { id: uid("aud"), actor, action, entity, entityId, detail, at: now() };
  db.auditLog.set(entry.id, entry);
  persist();
  return entry;
}
export async function save() { await persist(); }
