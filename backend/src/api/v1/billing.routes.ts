import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { hasPermission } from "../../auth/permissions.js";
import { ApiError } from "../../shared/errors.js";
import { withTenantTransaction } from "../../db/transaction.js";
import { findIdempotency, storeIdempotency } from "../../shared/idempotency.js";
import { BillingService } from "../../domain/billing/billing.service.js";
import { isValidMoneyString } from "../../shared/money.js";

export const billingRouter = Router();
billingRouter.use(authenticate);

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

function requireBillingRead(role: string) {
  if (!hasPermission(role, "billing:manage") && !hasPermission(role, "invoice:manage") && !hasPermission(role, "order:view")) {
    throw new ApiError(403, "FORBIDDEN", "Insufficient permissions");
  }
}

function requireBillingWrite(role: string) {
  if (!hasPermission(role, "billing:manage") && !hasPermission(role, "invoice:manage")) {
    throw new ApiError(403, "FORBIDDEN", "Insufficient permissions for billing mutation");
  }
}

function parseIfMatch(req: import("express").Request): number {
  const header = req.headers["if-match"] as string | undefined;
  if (!header) {
    throw new ApiError(400, "BAD_REQUEST", "If-Match header required", {
      hint: 'Send If-Match: W/"<revision>" or "<revision>"',
    });
  }
  const match = header.match(/W\/"(\d+)"|"(\d+)"|(\d+)/);
  const numStr = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!numStr) throw new ApiError(400, "BAD_REQUEST", "Invalid If-Match header");
  const n = Number(numStr);
  if (!Number.isInteger(n) || n < 1) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid revision in If-Match");
  }
  return n;
}

const changePreviewSchema = z.object({
  quantity: z.string().optional(),
  discountPct: z.string().optional(),
  unitPrice: z.string().optional(),
  effectiveAt: z.string().datetime(),
});

const cancelSchema = z.object({
  effectiveAt: z.string().datetime(),
  reason: z.string().max(1000).optional(),
});

const recordPaymentSchema = z.object({
  amount: z.string().refine(isValidMoneyString, "Invalid money amount"),
  paidAt: z.string().datetime(),
  reference: z.string().max(128).optional(),
  method: z.enum(["manual"]).optional(),
});

// GET /subscriptions
billingRouter.get("/subscriptions", async (req, res, next) => {
  try {
    const { tenantId, role } = getCtx(req);
    requireBillingRead(role);
    const { status, customerId, limit } = req.query;
    const parsedLimit = limit ? Math.min(100, Math.max(1, Number(limit))) : 50;

    const result = await withTenantTransaction({ tenantId }, async (tx) =>
      BillingService.listSubscriptions(tx, {
        tenantId,
        status: status as string | undefined,
        customerId: customerId as string | undefined,
        limit: parsedLimit,
      }),
    );

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /subscriptions/:id
billingRouter.get("/subscriptions/:id", async (req, res, next) => {
  try {
    const { tenantId, role } = getCtx(req);
    requireBillingRead(role);

    const result = await withTenantTransaction({ tenantId }, async (tx) =>
      BillingService.getSubscriptionById(tx, tenantId, req.params.id),
    );

    res.setHeader("ETag", `W/"${result.subscription.revision}"`);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// POST /subscriptions/:id/changes/preview
billingRouter.post("/subscriptions/:id/changes/preview", async (req, res, next) => {
  try {
    const { tenantId, role } = getCtx(req);
    requireBillingRead(role);

    const parsed = changePreviewSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid preview body", parsed.error.format());
    }

    const preview = await withTenantTransaction({ tenantId }, async (tx) => {
      const { subscription } = await BillingService.getSubscriptionById(tx, tenantId, req.params.id);
      return BillingService.previewSubscriptionChange(subscription, {
        quantity: parsed.data.quantity,
        discountPct: parsed.data.discountPct,
        unitPrice: parsed.data.unitPrice,
        effectiveAt: new Date(parsed.data.effectiveAt),
      });
    });

    return res.json({ preview });
  } catch (err) {
    return next(err);
  }
});

// POST /subscriptions/:id/changes (idempotent)
billingRouter.post("/subscriptions/:id/changes", async (req, res, next) => {
  try {
    const { tenantId, actorId, requestId, role } = getCtx(req);
    requireBillingWrite(role);

    const parsed = changePreviewSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid change body", parsed.error.format());
    }

    const ifMatchRevision = parseIfMatch(req);
    const idemKey = req.headers["idempotency-key"] as string | undefined;
    const subscriptionId = req.params.id;

    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      if (idemKey) {
        const cached = await findIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `subscriptions.change:${subscriptionId}`,
          key: idemKey,
        });
        if (cached?.responseBody) {
          return { isCached: true, status: Number(cached.responseStatus ?? 200), body: cached.responseBody as object };
        }
      }

      const applied = await BillingService.applySubscriptionChange(tx, {
        tenantId,
        subscriptionId,
        quantity: parsed.data.quantity,
        discountPct: parsed.data.discountPct,
        unitPrice: parsed.data.unitPrice,
        effectiveAt: new Date(parsed.data.effectiveAt),
        ifMatchRevision,
        actorId,
        requestId,
      });

      const responseBody = applied;
      if (idemKey) {
        await storeIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `subscriptions.change:${subscriptionId}`,
          key: idemKey,
          responseStatus: "200",
          responseBody,
        });
      }

      return { isCached: false, status: 200, body: responseBody };
    });

    const sub = (result.body as { subscription?: { revision?: number } }).subscription;
    if (sub?.revision) res.setHeader("ETag", `W/"${sub.revision}"`);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

// POST /subscriptions/:id/cancel (idempotent)
billingRouter.post("/subscriptions/:id/cancel", async (req, res, next) => {
  try {
    const { tenantId, actorId, requestId, role } = getCtx(req);
    requireBillingWrite(role);

    const parsed = cancelSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid cancel body", parsed.error.format());
    }

    const ifMatchRevision = parseIfMatch(req);
    const idemKey = req.headers["idempotency-key"] as string | undefined;
    const subscriptionId = req.params.id;

    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      if (idemKey) {
        const cached = await findIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `subscriptions.cancel:${subscriptionId}`,
          key: idemKey,
        });
        if (cached?.responseBody) {
          return { isCached: true, status: Number(cached.responseStatus ?? 200), body: cached.responseBody as object };
        }
      }

      const cancelled = await BillingService.cancelSubscription(tx, {
        tenantId,
        subscriptionId,
        effectiveAt: new Date(parsed.data.effectiveAt),
        reason: parsed.data.reason,
        ifMatchRevision,
        actorId,
        requestId,
      });

      const responseBody = cancelled;
      if (idemKey) {
        await storeIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `subscriptions.cancel:${subscriptionId}`,
          key: idemKey,
          responseStatus: "200",
          responseBody,
        });
      }

      return { isCached: false, status: 200, body: responseBody };
    });

    const sub = (result.body as { subscription?: { revision?: number } }).subscription;
    if (sub?.revision) res.setHeader("ETag", `W/"${sub.revision}"`);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

// GET /invoices
billingRouter.get("/invoices", async (req, res, next) => {
  try {
    const { tenantId, role } = getCtx(req);
    requireBillingRead(role);
    const { status, customerId, orderId, fromDate, toDate, limit } = req.query;
    const parsedLimit = limit ? Math.min(100, Math.max(1, Number(limit))) : 50;

    const result = await withTenantTransaction({ tenantId }, async (tx) =>
      BillingService.listInvoices(tx, {
        tenantId,
        status: status as string | undefined,
        customerId: customerId as string | undefined,
        orderId: orderId as string | undefined,
        fromDate: fromDate ? new Date(String(fromDate)) : undefined,
        toDate: toDate ? new Date(String(toDate)) : undefined,
        limit: parsedLimit,
      }),
    );

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /invoices/:id
billingRouter.get("/invoices/:id", async (req, res, next) => {
  try {
    const { tenantId, role } = getCtx(req);
    requireBillingRead(role);

    const result = await withTenantTransaction({ tenantId }, async (tx) =>
      BillingService.getInvoiceById(tx, tenantId, req.params.id),
    );

    res.setHeader("ETag", `W/"${result.invoice.revision}"`);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// POST /invoices/:id/record-payment (idempotent)
billingRouter.post("/invoices/:id/record-payment", async (req, res, next) => {
  try {
    const { tenantId, actorId, requestId, role } = getCtx(req);
    requireBillingWrite(role);

    const parsed = recordPaymentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid payment body", parsed.error.format());
    }

    const idemKey = req.headers["idempotency-key"] as string | undefined;
    const invoiceId = req.params.id;

    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      if (idemKey) {
        const cached = await findIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `invoices.record-payment:${invoiceId}`,
          key: idemKey,
        });
        if (cached?.responseBody) {
          return { isCached: true, status: Number(cached.responseStatus ?? 200), body: cached.responseBody as object };
        }
      }

      const recorded = await BillingService.recordPayment(tx, {
        tenantId,
        invoiceId,
        amount: parsed.data.amount,
        paidAt: new Date(parsed.data.paidAt),
        reference: parsed.data.reference,
        method: parsed.data.method ?? "manual",
        actorId,
        requestId,
      });

      const responseBody = recorded;
      if (idemKey) {
        await storeIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `invoices.record-payment:${invoiceId}`,
          key: idemKey,
          responseStatus: "200",
          responseBody,
        });
      }

      return { isCached: false, status: 200, body: responseBody };
    });

    const inv = (result.body as { invoice?: { revision?: number } }).invoice;
    if (inv?.revision) res.setHeader("ETag", `W/"${inv.revision}"`);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});
