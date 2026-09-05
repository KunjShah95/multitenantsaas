import jwt from "jsonwebtoken";
export const JWT_SECRET = process.env.JWT_SECRET || "dealflow360-dev-secret";
export function sign(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}
export function auth(required = true) {
  return (req, res, next) => {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) {
      if (!required) return next();
      return res.status(401).json({ error: "Missing token" });
    }
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    // customer portal users have role customer; allow through
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden for role " + req.user.role });
    next();
  };
}
