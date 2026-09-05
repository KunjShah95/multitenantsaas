import { eq, and, desc, inArray } from "drizzle-orm";
import type { Db } from "../../db/connection.js";
import * as schema from "../../db/schema/index.js";
import { ApiError } from "../../shared/errors.js";
import { writeAuditEvent } from "../../shared/audit.js";
import { generateOrderNumber } from "./orderNumber.js";
import { BillingService } from "../billing/billing.service.js";

export interface ConvertQuoteToOrderInput {
  tenantId: string;
  quoteId: string;
  actorId?: string | null;
  requestId?: string | null;
}

export interface ListOrdersFilters {
  tenantId: string;
  status?: string;
  customerId?: string;
  limit?: number;
  cursor?: string;
}

export class OrdersService {
  /**
   * Idempotent quote-to-order conversion.
   * Requires quote to be in readyForOrder or customerAccepted (or approvedInternal).
   * Copies immutable snapshot of accepted quote version and line details.
   */
  static async convertQuoteToOrder(tx: Db, input: ConvertQuoteToOrderInput) {
    const { tenantId, quoteId, actorId, requestId } = input;

    // Fetch quote
    const [quote] = await tx
      .select()
      .from(schema.quotes)
      .where(and(eq(schema.quotes.tenantId, tenantId), eq(schema.quotes.id, quoteId)))
      .limit(1);

    if (!quote) {
      throw new ApiError(404, "NOT_FOUND", "Quote not found");
    }

    // Check if an order already exists for this quote & current version (idempotency)
    const [existingOrder] = await tx
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.tenantId, tenantId),
          eq(schema.orders.quoteId, quoteId),
          eq(schema.orders.quoteVersionNumber, quote.currentVersion),
        ),
      )
      .limit(1);

    if (existingOrder) {
      // Idempotently return existing order with lines
      const lines = await tx
        .select()
        .from(schema.orderLines)
        .where(
          and(
            eq(schema.orderLines.tenantId, tenantId),
            eq(schema.orderLines.orderId, existingOrder.id),
          ),
        );

      await BillingService.initializeBillingForOrder(tx, {
        tenantId,
        orderId: existingOrder.id,
        actorId,
        requestId,
      });

      return { order: existingOrder, lines, isExisting: true };
    }

    // Validate quote status
    const allowedStatuses = ["readyForOrder", "customerAccepted", "approvedInternal"];
    if (!allowedStatuses.includes(quote.status)) {
      throw new ApiError(
        422,
        "UNPROCESSABLE",
        `Quote in status '${quote.status}' cannot be converted to an order. Must be ready for order.`,
      );
    }

    // Fetch accepted quote version
    const [version] = await tx
      .select()
      .from(schema.quoteVersions)
      .where(
        and(
          eq(schema.quoteVersions.tenantId, tenantId),
          eq(schema.quoteVersions.quoteId, quoteId),
          eq(schema.quoteVersions.versionNumber, quote.currentVersion),
        ),
      )
      .limit(1);

    if (!version) {
      throw new ApiError(422, "UNPROCESSABLE", "Accepted quote version record was not found");
    }

    // Fetch current quote lines
    const lines = await tx
      .select()
      .from(schema.quoteLines)
      .where(and(eq(schema.quoteLines.tenantId, tenantId), eq(schema.quoteLines.quoteId, quoteId)));

    if (lines.length === 0) {
      throw new ApiError(422, "UNPROCESSABLE", "Cannot convert a quote with no lines");
    }

    // Generate unique order number with collision retry
    let orderNumber = generateOrderNumber();
    let attempts = 0;
    while (attempts < 5) {
      const [existing] = await tx
        .select({ id: schema.orders.id })
        .from(schema.orders)
        .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.number, orderNumber)))
        .limit(1);
      if (!existing) break;
      orderNumber = generateOrderNumber();
      attempts++;
    }

    // Insert order snapshot
    const [order] = await tx
      .insert(schema.orders)
      .values({
        tenantId,
        number: orderNumber,
        quoteId: quote.id,
        quoteVersionId: version.id,
        quoteVersionNumber: version.versionNumber,
        customerId: quote.customerId,
        currency: quote.currency,
        status: "orderCreated",
        revision: 1,
        snapshot: version.snapshot,
        subtotal: quote.subtotal,
        discountTotal: quote.discountTotal,
        netTotal: quote.netTotal,
        taxTotal: quote.taxTotal,
        grandTotal: quote.grandTotal,
        createdBy: actorId ?? null,
      })
      .returning();

    if (!order) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to create order");
    }

    // Insert order lines
    const orderLinesToInsert = lines.map((line) => ({
      tenantId,
      orderId: order.id,
      quoteLineId: line.id,
      productId: line.productId,
      variantId: line.variantId ?? null,
      subscriptionPlanId: line.subscriptionPlanId ?? null,
      quantity: line.quantity,
      discountPct: line.discountPct,
      billingType: line.billingType,
      snapshotName: line.snapshotName,
      snapshotSku: line.snapshotSku,
      snapshotVariantSku: line.snapshotVariantSku ?? null,
      snapshotCategoryId: line.snapshotCategoryId ?? null,
      snapshotCategoryCode: line.snapshotCategoryCode ?? null,
      snapshotUnit: line.snapshotUnit,
      snapshotUnitPrice: line.snapshotUnitPrice,
      snapshotUnitCost: line.snapshotUnitCost,
      snapshotTaxRatePct: line.snapshotTaxRatePct,
      snapshotCurrency: line.snapshotCurrency,
      lineSubtotal: line.lineSubtotal,
      lineDiscount: line.lineDiscount,
      lineNet: line.lineNet,
      lineTax: line.lineTax,
      lineTotal: line.lineTotal,
      lineMargin: line.lineMargin ?? null,
      lineMarginPct: line.lineMarginPct ?? null,
    }));

    const insertedLines = await tx.insert(schema.orderLines).values(orderLinesToInsert).returning();

    // Update quote status to converted
    await tx
      .update(schema.quotes)
      .set({
        status: "converted",
        updatedAt: new Date(),
      })
      .where(and(eq(schema.quotes.tenantId, tenantId), eq(schema.quotes.id, quoteId)));

    // Write audit event
    await writeAuditEvent(tx, {
      tenantId,
      actorId,
      action: "order.created",
      entityType: "order",
      entityId: order.id,
      detail: {
        orderNumber: order.number,
        quoteId: quote.id,
        quoteVersionNumber: version.versionNumber,
        grandTotal: order.grandTotal,
        lineCount: insertedLines.length,
      },
      requestId,
    });

    // Write outbox event
    await tx.insert(schema.outboxEvents).values({
      tenantId,
      aggregateType: "order",
      aggregateId: order.id,
      eventType: "order.updated",
      payload: {
        orderId: order.id,
        orderNumber: order.number,
        status: order.status,
        revision: order.revision,
      },
    });

    await BillingService.initializeBillingForOrder(tx, {
      tenantId,
      orderId: order.id,
      actorId,
      requestId,
    });

    return { order, lines: insertedLines, isExisting: false };
  }

  /**
   * List orders with filtering and pagination
   */
  static async listOrders(tx: Db, filters: ListOrdersFilters) {
    const { tenantId, status, customerId, limit = 50 } = filters;

    const conditions = [eq(schema.orders.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(schema.orders.status, status));
    }
    if (customerId) {
      conditions.push(eq(schema.orders.customerId, customerId));
    }

    const orderRows = await tx
      .select()
      .from(schema.orders)
      .where(and(...conditions))
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit);

    return orderRows;
  }

  /**
   * Get single order by ID with all lines, plans, reservations, and shipments
   */
  static async getOrderById(tx: Db, tenantId: string, orderId: string) {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.id, orderId)))
      .limit(1);

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "Order not found");
    }

    const lines = await tx
      .select()
      .from(schema.orderLines)
      .where(and(eq(schema.orderLines.tenantId, tenantId), eq(schema.orderLines.orderId, orderId)));

    const plans = await tx
      .select()
      .from(schema.fulfillmentPlans)
      .where(
        and(
          eq(schema.fulfillmentPlans.tenantId, tenantId),
          eq(schema.fulfillmentPlans.orderId, orderId),
        ),
      )
      .orderBy(desc(schema.fulfillmentPlans.createdAt));

    const latestPlan = plans[0] ?? null;
    let allocations: (typeof schema.fulfillmentAllocations.$inferSelect)[] = [];
    if (latestPlan) {
      allocations = await tx
        .select()
        .from(schema.fulfillmentAllocations)
        .where(
          and(
            eq(schema.fulfillmentAllocations.tenantId, tenantId),
            eq(schema.fulfillmentAllocations.fulfillmentPlanId, latestPlan.id),
          ),
        );
    }

    const reservations = await tx
      .select()
      .from(schema.inventoryReservations)
      .where(
        and(
          eq(schema.inventoryReservations.tenantId, tenantId),
          eq(schema.inventoryReservations.orderId, orderId),
        ),
      );

    const orderShipments = await tx
      .select()
      .from(schema.shipments)
      .where(and(eq(schema.shipments.tenantId, tenantId), eq(schema.shipments.orderId, orderId)))
      .orderBy(desc(schema.shipments.createdAt));

    const shipmentIds = orderShipments.map((s) => s.id);
    let allShipmentLines: (typeof schema.shipmentLines.$inferSelect)[] = [];
    if (shipmentIds.length > 0) {
      allShipmentLines = await tx
        .select()
        .from(schema.shipmentLines)
        .where(
          and(
            eq(schema.shipmentLines.tenantId, tenantId),
            inArray(schema.shipmentLines.shipmentId, shipmentIds),
          ),
        );
    }

    const enrichedShipments = orderShipments.map((s) => ({
      ...s,
      lines: allShipmentLines.filter((l) => l.shipmentId === s.id),
    }));

    return {
      ...order,
      lines,
      fulfillmentPlan: latestPlan ? { ...latestPlan, allocations } : null,
      reservations,
      shipments: enrichedShipments,
    };
  }

  /**
   * Customer-safe portal order view (redacting unit costs and margins)
   */
  static async getPortalOrderById(tx: Db, tenantId: string, customerId: string, orderId: string) {
    const fullOrder = await this.getOrderById(tx, tenantId, orderId);
    if (fullOrder.customerId !== customerId) {
      throw new ApiError(404, "NOT_FOUND", "Order not found");
    }

    // Redact internal financial fields
    const safeLines = fullOrder.lines.map((line) => {
      const {
        snapshotUnitCost: _snapshotUnitCost,
        lineMargin: _lineMargin,
        lineMarginPct: _lineMarginPct,
        ...safeLine
      } = line;
      return safeLine;
    });

    const { ...safeOrder } = fullOrder;

    return {
      ...safeOrder,
      lines: safeLines,
    };
  }
}
