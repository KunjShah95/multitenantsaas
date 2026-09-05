import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { hasPermission } from "../../auth/permissions.js";
import { ApiError } from "../../shared/errors.js";
import { withTenantTransaction } from "../../db/transaction.js";
import { findIdempotency, storeIdempotency } from "../../shared/idempotency.js";
import { HealthService } from "../../domain/health/health.service.js";
import { SseHub } from "../../domain/events/sse.hub.js";

export const healthRouter = Router();
healthRouter.use(authenticate);

function getCtx(req: import("express").Request) {
  const auth = req.auth!;
  const requestId = (req as unknown as { requestId: string }).requestId;
  return {
    tenantId: auth.tenantId,
    actorId: auth.userId,
    requestId,
    role: auth.role,
  };
}

function requireHealthRead(role: string) {
  if (!hasPermission(role, "deal_health:view") && !hasPermission(role, "report:view")) {
    throw new ApiError(403, "FORBIDDEN", "Insufficient permissions to view deal health");
  }
}

function requireHealthNudge(role: string) {
  if (!hasPermission(role, "deal_health:nudge")) {
    throw new ApiError(403, "FORBIDDEN", "Insufficient permissions to nudge alerts");
  }
}

const nudgeSchema = z.object({
  message: z.string().max(500).optional(),
});

// GET /deal-health
healthRouter.get("/deal-health", async (req, res, next) => {
  try {
    const { tenantId, actorId, role } = getCtx(req);
    requireHealthRead(role);

    const result = await withTenantTransaction({ tenantId }, async (tx) => {
      // Auto-scan if no alerts exist yet for initial demo convenience
      const existing = await HealthService.getDealHealth(tx, tenantId, {
        userId: actorId,
        role,
      });
      if (existing.summary.totalActive === 0) {
        await HealthService.scanDealHealth(tx, tenantId);
        return HealthService.getDealHealth(tx, tenantId, {
          userId: actorId,
          role,
        });
      }
      return existing;
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// POST /deal-health/scan (manual trigger for cron or demo)
healthRouter.post("/deal-health/scan", async (req, res, next) => {
  try {
    const { tenantId, role } = getCtx(req);
    requireHealthRead(role);

    const result = await withTenantTransaction({ tenantId }, async (tx) =>
      HealthService.scanDealHealth(tx, tenantId),
    );

    return res.json({ scanned: true, ...result });
  } catch (err) {
    return next(err);
  }
});

// POST /deal-health/alerts/:id/nudge (idempotent)
healthRouter.post("/deal-health/alerts/:id/nudge", async (req, res, next) => {
  try {
    const { tenantId, actorId, requestId, role } = getCtx(req);
    requireHealthNudge(role);

    const parsed = nudgeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid nudge body", parsed.error.format());
    }

    const idemKey = req.headers["idempotency-key"] as string | undefined;
    const alertId = req.params.id;

    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      if (idemKey) {
        const cached = await findIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `deal-health.nudge:${alertId}`,
          key: idemKey,
        });
        if (cached?.responseBody) {
          return {
            isCached: true,
            status: Number(cached.responseStatus ?? 200),
            body: cached.responseBody as object,
          };
        }
      }

      const nudged = await HealthService.nudgeAlert(tx, {
        tenantId,
        alertId,
        message: parsed.data.message,
        actorId,
        requestId,
      });

      if (idemKey) {
        await storeIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `deal-health.nudge:${alertId}`,
          key: idemKey,
          responseStatus: "200",
          responseBody: nudged,
        });
      }

      return { isCached: false, status: 200, body: nudged };
    });

    // Broadcast SSE notification to active subscribers
    SseHub.broadcast(tenantId, {
      eventId: alertId,
      type: "alert.nudged",
      entityId: alertId,
      occurredAt: new Date().toISOString(),
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});
