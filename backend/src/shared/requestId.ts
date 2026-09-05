import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers["x-request-id"];
  const id = typeof incoming === "string" && incoming.length > 0 ? incoming : `req_${randomUUID()}`;
  (req as unknown as Record<string, unknown>).requestId = id;
  res.setHeader("x-request-id", id);
  next();
}
