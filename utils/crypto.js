import crypto from "node:crypto";
export function hash(pw) { return crypto.createHash("sha256").update(String(pw)).digest("hex"); }
export function verify(pw, h) { return hash(pw) === h; }
