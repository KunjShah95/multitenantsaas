import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { ApiError } from "../../shared/errors.js";
import { withTenantTransaction } from "../../db/transaction.js";
import { findIdempotency, storeIdempotency } from "../../shared/idempotency.js";
import { OrdersService } from "../../domain/orders/orders.service.js";
import { FulfillmentService } from "../../domain/fulfillment/fulfillment.service.js";

export const ordersRouter = Router();
ordersRouter.use(authenticate);

function getCtx(req: import("express").Request) {
  const auth = req.auth!;
  const requestId = (req as unknown as { requestId: string }).requestId;
  return {
    tenantId: auth.tenantId,
    actorId: auth.userId,
    requestId,
    role: auth.role,
    userId: auth.userId,
    membershipId: auth.membershipId,
  };
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

// ---------------------------------------------------------------------------
// 1. POST /quotes/:id/convert-to-order (idempotent quote-to-order conversion)
// ---------------------------------------------------------------------------
ordersRouter.post("/quotes/:id/convert-to-order", async (req, res, next) => {
  try {
    const { tenantId, actorId, requestId, role } = getCtx(req);
    const quoteId = req.params.id;

    if (!["admin", "rep", "manager"].includes(role)) {
      throw new ApiError(403, "FORBIDDEN", "Insufficient permissions to convert quote");
    }

    const idemKey = req.headers["idempotency-key"] as string | undefined;

    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      if (idemKey) {
        const cached = await findIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: "orders.convert-to-order",
          key: idemKey,
        });
        if (cached && cached.responseBody) {
          return {
            isCached: true,
            status: Number(cached.responseStatus ?? 200),
            body: cached.responseBody as any,
          };
        }
      }

      const conv = await OrdersService.convertQuoteToOrder(tx, {
        tenantId,
        quoteId,
        actorId,
        requestId,
      });

      const responseBody = {
        order: conv.order,
        lines: conv.lines,
        isExisting: conv.isExisting,
      };
      const statusCode = conv.isExisting ? 200 : 201;

      if (idemKey) {
        await storeIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: "orders.convert-to-order",
          key: idemKey,
          responseStatus: String(statusCode),
          responseBody,
        });
      }

      return { isCached: false, status: statusCode, body: responseBody };
    });

    res.setHeader("ETag", `W/"${result.body.order.revision}"`);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// 2. GET /orders (list orders)
// ---------------------------------------------------------------------------
ordersRouter.get("/orders", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const { status, customerId, limit } = req.query;

    const parsedLimit = limit ? Math.min(100, Math.max(1, Number(limit))) : 50;

    const rows = await withTenantTransaction({ tenantId }, async (tx) => {
      return OrdersService.listOrders(tx, {
        tenantId,
        status: status as string | undefined,
        customerId: customerId as string | undefined,
        limit: parsedLimit,
      });
    });

    return res.json({ orders: rows });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// 3. GET /orders/:id (get single order with details)
// ---------------------------------------------------------------------------
ordersRouter.get("/orders/:id", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const orderId = req.params.id;

    const order = await withTenantTransaction({ tenantId }, async (tx) => {
      return OrdersService.getOrderById(tx, tenantId, orderId);
    });

    res.setHeader("ETag", `W/"${order.revision}"`);
    return res.json({ order });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// 4. POST /orders/:id/fulfillment-plans/preview (pure optimizer preview)
// ---------------------------------------------------------------------------
ordersRouter.post("/orders/:id/fulfillment-plans/preview", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const orderId = req.params.id;

    const schemaValidator = z
      .object({
        shipmentPenalty: z.number().positive().optional(),
        backorderPenalty: z.number().positive().optional(),
        costWeightMultiplier: z.number().positive().optional(),
      })
      .optional();

    const parsed = schemaValidator?.safeParse(req.body ?? {});
    const options = parsed?.success ? parsed.data : {};

    const preview = await withTenantTransaction({ tenantId }, async (tx) => {
      return FulfillmentService.generatePreview(tx, tenantId, orderId, options);
    });

    return res.json({ preview });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// 5. POST /orders/:id/fulfillment-plans/confirm (idempotent confirmation)
// ---------------------------------------------------------------------------
const confirmPlanSchema = z.object({
  manualAllocations: z
    .array(
      z.object({
        orderLineId: z.string().uuid(),
        warehouseId: z.string().uuid(),
        quantity: z.union([z.string(), z.number()]),
      }),
    )
    .optional(),
});

ordersRouter.post("/orders/:id/fulfillment-plans/confirm", async (req, res, next) => {
  try {
    const { tenantId, actorId, requestId, role } = getCtx(req);
    const orderId = req.params.id;

    if (!["admin", "manager", "ops"].includes(role)) {
      throw new ApiError(403, "FORBIDDEN", "Insufficient permissions to confirm fulfillment plan");
    }

    const ifMatchRevision = parseIfMatch(req);

    const parsed = confirmPlanSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid confirmation body", parsed.error.format());
    }

    const idemKey = req.headers["idempotency-key"] as string | undefined;

    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      if (idemKey) {
        const cached = await findIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `orders.confirm:${orderId}`,
          key: idemKey,
        });
        if (cached && cached.responseBody) {
          return {
            isCached: true,
            status: Number(cached.responseStatus ?? 200),
            body: cached.responseBody as any,
          };
        }
      }

      const confirmed = await FulfillmentService.confirmAllocation(tx, tenantId, orderId, {
        manualAllocations: parsed.data.manualAllocations,
        ifMatchRevision,
        actorId,
        requestId,
      });

      const responseBody = {
        order: confirmed.order,
        fulfillmentPlan: confirmed.fulfillmentPlan,
        reservations: confirmed.reservations,
      };

      if (idemKey) {
        await storeIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `orders.confirm:${orderId}`,
          key: idemKey,
          responseStatus: "200",
          responseBody,
        });
      }

      return { isCached: false, status: 200, body: responseBody };
    });

    res.setHeader("ETag", `W/"${result.body.order.revision}"`);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// 6. POST /orders/:id/shipments (idempotent shipment command)
// ---------------------------------------------------------------------------
const createShipmentSchema = z.object({
  warehouseId: z.string().uuid(),
  reservationIds: z.array(z.string().uuid()).optional(),
  items: z
    .array(
      z.object({
        reservationId: z.string().uuid(),
        quantity: z.union([z.string(), z.number()]),
      }),
    )
    .optional(),
  carrier: z.string().max(64).optional(),
  trackingNumber: z.string().max(128).optional(),
  notes: z.string().max(1000).optional(),
});

ordersRouter.post("/orders/:id/shipments", async (req, res, next) => {
  try {
    const { tenantId, actorId, requestId, role } = getCtx(req);
    const orderId = req.params.id;

    if (!["admin", "manager", "ops"].includes(role)) {
      throw new ApiError(403, "FORBIDDEN", "Insufficient permissions to create shipments");
    }

    const parsed = createShipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid shipment payload", parsed.error.format());
    }

    const idemKey = req.headers["idempotency-key"] as string | undefined;

    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      if (idemKey) {
        const cached = await findIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `orders.shipment:${orderId}`,
          key: idemKey,
        });
        if (cached && cached.responseBody) {
          return {
            isCached: true,
            status: Number(cached.responseStatus ?? 201),
            body: cached.responseBody as any,
          };
        }
      }

      const shipped = await FulfillmentService.createShipment(tx, tenantId, orderId, {
        warehouseId: parsed.data.warehouseId,
        reservationIds: parsed.data.reservationIds,
        items: parsed.data.items,
        carrier: parsed.data.carrier,
        trackingNumber: parsed.data.trackingNumber,
        notes: parsed.data.notes,
        actorId,
        requestId,
      });

      const responseBody = {
        order: shipped.order,
        shipment: shipped.shipment,
      };

      if (idemKey) {
        await storeIdempotency(tx, {
          tenantId,
          actorId: actorId ?? "anonymous",
          operation: `orders.shipment:${orderId}`,
          key: idemKey,
          responseStatus: "201",
          responseBody,
        });
      }

      return { isCached: false, status: 201, body: responseBody };
    });

    res.setHeader("ETag", `W/"${result.body.order.revision}"`);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// 7. POST /orders/:id/backorders/replan (replan unfulfilled backorders)
// ---------------------------------------------------------------------------
ordersRouter.post("/orders/:id/backorders/replan", async (req, res, next) => {
  try {
    const { tenantId, actorId, requestId, role } = getCtx(req);
    const orderId = req.params.id;

    if (!["admin", "manager", "ops"].includes(role)) {
      throw new ApiError(403, "FORBIDDEN", "Insufficient permissions to replan backorders");
    }

    const preview = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      return FulfillmentService.replanBackorder(tx, tenantId, orderId, actorId, requestId);
    });

    return res.json({ replan: preview });
  } catch (err) {
    return next(err);
  }
});
