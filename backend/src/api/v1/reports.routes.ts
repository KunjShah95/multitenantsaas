import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { hasPermission } from "../../auth/permissions.js";
import { ApiError } from "../../shared/errors.js";
import { withTenantTransaction } from "../../db/transaction.js";
import { findIdempotency, storeIdempotency } from "../../shared/idempotency.js";
import { ReportsService } from "../../domain/reports/reports.service.js";
import { ExportsService } from "../../domain/reports/exports.service.js";
import { SseHub } from "../../domain/events/sse.hub.js";

export const reportsRouter = Router();
reportsRouter.use(authenticate);

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

function requireReportRead(role: string) {
  if (!hasPermission(role, "report:view")) {
    throw new ApiError(403, "FORBIDDEN", "Insufficient permissions to view reports");
  }
}

function requireReportExport(role: string) {
  if (!hasPermission(role, "report:export") && !hasPermission(role, "report:view")) {
    throw new ApiError(403, "FORBIDDEN", "Insufficient permissions to export reports");
  }
}

const exportSchema = z.object({
  reportType: z.enum(["quotes", "orders", "sales"]),
  format: z.enum(["csv", "json"]).default("csv"),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

// GET /reports/quotes
reportsRouter.get("/reports/quotes", async (req, res, next) => {
  try {
    const { tenantId, role } = getCtx(req);
    requireReportRead(role);

    const { fromDate, toDate, teamId, ownerUserId, customerId, status, currency, limit, cursor } =
      req.query;

    const parsedLimit = limit ? Math.min(100, Math.max(1, Number(limit))) : 50;

    const result = await withTenantTransaction({ tenantId }, async (tx) =>
      ReportsService.getQuoteReport(
        tx,
        tenantId,
        {
          fromDate: fromDate ? new Date(String(fromDate)) : undefined,
          toDate: toDate ? new Date(String(toDate)) : undefined,
          teamId: teamId ? String(teamId) : undefined,
          ownerUserId: ownerUserId ? String(ownerUserId) : undefined,
          customerId: customerId ? String(customerId) : undefined,
          status: status ? String(status) : undefined,
          currency: currency ? String(currency) : undefined,
        },
        { limit: parsedLimit, cursor: cursor ? String(cursor) : undefined },
      ),
    );

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /reports/orders
reportsRouter.get("/reports/orders", async (req, res, next) => {
  try {
    const { tenantId, role } = getCtx(req);
    requireReportRead(role);

    const { fromDate, toDate, customerId, status, currency, limit, cursor } = req.query;
    const parsedLimit = limit ? Math.min(100, Math.max(1, Number(limit))) : 50;

    const result = await withTenantTransaction({ tenantId }, async (tx) =>
      ReportsService.getOrderReport(
        tx,
        tenantId,
        {
          fromDate: fromDate ? new Date(String(fromDate)) : undefined,
          toDate: toDate ? new Date(String(toDate)) : undefined,
          customerId: customerId ? String(customerId) : undefined,
          status: status ? String(status) : undefined,
          currency: currency ? String(currency) : undefined,
        },
        { limit: parsedLimit, cursor: cursor ? String(cursor) : undefined },
      ),
    );

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /reports/sales
reportsRouter.get("/reports/sales", async (req, res, next) => {
  try {
    const { tenantId, role } = getCtx(req);
    requireReportRead(role);

    const { fromDate, toDate, currency } = req.query;

    const result = await withTenantTransaction({ tenantId }, async (tx) =>
      ReportsService.getSalesReport(tx, tenantId, {
        fromDate: fromDate ? new Date(String(fromDate)) : undefined,
        toDate: toDate ? new Date(String(toDate)) : undefined,
        currency: currency ? String(currency) : undefined,
      }),
    );

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// POST /report-exports (idempotent)
reportsRouter.post("/report-exports", async (req, res, next) => {
  try {
    const { tenantId, actorId, requestId, role } = getCtx(req);
    requireReportExport(role);

    const parsed = exportSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid export request body", parsed.error.format());
    }

    const idemKey = req.headers["idempotency-key"] as string | undefined;

    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      if (idemKey) {
        const cached = await findIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `report-exports.create`,
          key: idemKey,
        });
        if (cached?.responseBody) {
          return {
            isCached: true,
            status: Number(cached.responseStatus ?? 201),
            body: cached.responseBody as object,
          };
        }
      }

      const created = await ExportsService.createReportExport(tx, {
        tenantId,
        requestedBy: actorId,
        reportType: parsed.data.reportType,
        format: parsed.data.format,
        parameters: parsed.data.parameters,
        actorId,
        requestId,
      });

      if (idemKey) {
        await storeIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `report-exports.create`,
          key: idemKey,
          responseStatus: "201",
          responseBody: created,
        });
      }

      return { isCached: false, status: 201, body: created };
    });

    const exportData = (result.body as { export?: { id?: string } }).export;
    if (exportData?.id) {
      SseHub.broadcast(tenantId, {
        eventId: exportData.id,
        type: "reportExport.completed",
        entityId: exportData.id,
        occurredAt: new Date().toISOString(),
      });
    }

    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

// GET /report-exports/:id
reportsRouter.get("/report-exports/:id", async (req, res, next) => {
  try {
    const { tenantId, role } = getCtx(req);
    requireReportExport(role);

    const result = await withTenantTransaction({ tenantId }, async (tx) =>
      ExportsService.getExportStatus(tx, tenantId, req.params.id),
    );

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /report-exports/:id/download
reportsRouter.get("/report-exports/:id/download", async (req, res, next) => {
  try {
    const { tenantId, role } = getCtx(req);
    requireReportExport(role);

    const token = req.query.token as string | undefined;
    if (!token) {
      throw new ApiError(400, "BAD_REQUEST", "Missing download token");
    }

    const result = await withTenantTransaction({ tenantId }, async (tx) =>
      ExportsService.getExportDownload(tx, tenantId, req.params.id, token),
    );

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.send(result.fileContent);
  } catch (err) {
    return next(err);
  }
});
