import type { Request, Response } from "express";
import type { Express } from "express";
import { getEnv } from "../config/env.js";

export function mountHealthRoutes(app: Express) {
  // Liveness: process is alive — no dependency checks
  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      app: "DealFlow360",
      time: new Date().toISOString(),
    });
  });

  // Readiness: safe dependency checks — DB deferred until Phase 1
  app.get("/readyz", async (_req: Request, res: Response) => {
    const env = (() => {
      try {
        return getEnv();
      } catch {
        return null;
      }
    })();

    const checks: Array<{ name: string; status: "ok" | "deferred" | "fail"; message?: string }> = [
      { name: "app", status: "ok" },
    ];

    // Database check is deferred until Phase 1 (Neon integration).
    // If DATABASE_URL is present we report deferred as well — actual pool check lands in Phase 1.
    if (!env?.DATABASE_URL) {
      checks.push({
        name: "database",
        status: "deferred",
        message: "DATABASE_URL not configured — deferred until Phase 1",
      });
    } else {
      checks.push({
        name: "database",
        status: "deferred",
        message: "database readiness check deferred until Phase 1",
      });
    }

    const hasFail = checks.some((c) => c.status === "fail");
    res.status(hasFail ? 503 : 200).json({
      status: hasFail ? "not_ready" : "ok",
      checks,
      time: new Date().toISOString(),
    });
  });

  // Legacy alias for backwards compat (existing verify scripts use /health)
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, app: "DealFlow360", time: new Date().toISOString() });
  });
}
