import { eq, and, sql, inArray } from "drizzle-orm";
import type { Db } from "../../db/connection.js";
import * as schema from "../../db/schema/index.js";
import { ApiError } from "../../shared/errors.js";
import { writeAuditEvent } from "../../shared/audit.js";
import { generateShipmentNumber } from "../orders/orderNumber.js";
import { BillingService } from "../billing/billing.service.js";
import {
  optimizeFulfillment,
  type OptimizerItem,
  type OptimizerWarehouse,
  type OptimizerStockBalance,
  type OptimizerOptions,
  type OptimizerResult,
} from "./optimizer.js";

export interface ManualAllocationItem {
  orderLineId: string;
  warehouseId: string;
  quantity: string | number;
}

export interface ConfirmAllocationInput {
  manualAllocations?: ManualAllocationItem[];
  ifMatchRevision: number;
  actorId?: string | null;
  requestId?: string | null;
}

export interface CreateShipmentInput {
  warehouseId: string;
  reservationIds?: string[];
  items?: Array<{ reservationId: string; quantity: string | number }>;
  carrier?: string;
  trackingNumber?: string;
  notes?: string;
  actorId?: string | null;
  requestId?: string | null;
}

export class FulfillmentService {
  /**
   * Pure allocation preview optimizer (zero DB writes)
   */
  static async generatePreview(
    tx: Db,
    tenantId: string,
    orderId: string,
    options?: OptimizerOptions,
  ): Promise<OptimizerResult> {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.id, orderId)))
      .limit(1);

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "Order not found");
    }

    // Fetch order lines
    const lines = await tx
      .select()
      .from(schema.orderLines)
      .where(and(eq(schema.orderLines.tenantId, tenantId), eq(schema.orderLines.orderId, orderId)));

    // Physical items only (lines with non-empty snapshotSku)
    const items: OptimizerItem[] = lines
      .filter((l) => Boolean(l.snapshotSku && l.snapshotSku.trim().length > 0))
      .map((l) => ({
        orderLineId: l.id,
        productId: l.productId,
        variantId: l.variantId ?? null,
        sku: l.snapshotSku,
        requestedQty: Number(l.quantity),
      }));

    // Active warehouses
    const warehouseRows = await tx
      .select()
      .from(schema.warehouses)
      .where(eq(schema.warehouses.tenantId, tenantId));

    const warehouses: OptimizerWarehouse[] = warehouseRows.map((w) => ({
      id: w.id,
      name: w.name,
      code: w.code,
      shippingCostWeight: Number(w.shippingCostWeight ?? 1),
      archivedAt: w.archivedAt,
    }));

    // Stock balances for active warehouses
    const balanceRows = await tx
      .select()
      .from(schema.inventoryBalances)
      .where(eq(schema.inventoryBalances.tenantId, tenantId));

    const balances: OptimizerStockBalance[] = balanceRows.map((b) => ({
      warehouseId: b.warehouseId,
      sku: b.sku,
      onHandQty: Number(b.onHandQty),
      reservedQty: Number(b.reservedQty),
    }));

    return optimizeFulfillment(items, warehouses, balances, options);
  }

  /**
   * Idempotent allocation confirmation under row locks.
   * Enforces If-Match, sorts balance rows to prevent deadlocks, creates reservations,
   * updates inventory balances, and returns 409 with fresh preview on insufficient stock.
   */
  static async confirmAllocation(
    tx: Db,
    tenantId: string,
    orderId: string,
    input: ConfirmAllocationInput,
  ) {
    const { manualAllocations, ifMatchRevision, actorId, requestId } = input;

    // 1. Lock the order row
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.id, orderId)))
      .for("update");

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "Order not found");
    }

    // 2. Validate revision
    if (order.revision !== ifMatchRevision) {
      throw new ApiError(
        412,
        "VERSION_CONFLICT",
        `Order revision mismatch. Expected revision ${order.revision}, received ${ifMatchRevision}.`,
      );
    }

    // 3. Validate order status
    const allocatableStatuses = ["orderCreated", "allocationPlanned", "backordered"];
    if (!allocatableStatuses.includes(order.status)) {
      throw new ApiError(
        422,
        "UNPROCESSABLE",
        `Order in status '${order.status}' cannot be confirmed for fulfillment.`,
      );
    }

    // 4. Fetch order lines
    const lines = await tx
      .select()
      .from(schema.orderLines)
      .where(and(eq(schema.orderLines.tenantId, tenantId), eq(schema.orderLines.orderId, orderId)));

    const lineMap = new Map(lines.map((l) => [l.id, l]));

    // Determine target allocations
    interface TargetAlloc {
      orderLineId: string;
      productId: string;
      variantId?: string | null;
      warehouseId: string;
      sku: string;
      requestedQty: number;
      allocatedQty: number;
      backorderedQty: number;
      reason?: string | null;
    }

    let targetAllocations: TargetAlloc[] = [];
    let estimatedCost = "0.0000";
    let estimatedShipments = 0;

    if (manualAllocations && manualAllocations.length > 0) {
      // Validate manual allocations
      for (const m of manualAllocations) {
        const line = lineMap.get(m.orderLineId);
        if (!line) {
          throw new ApiError(
            422,
            "UNPROCESSABLE",
            `Order line ${m.orderLineId} does not belong to order`,
          );
        }
        const qty = Number(m.quantity);
        if (qty <= 0) {
          throw new ApiError(422, "UNPROCESSABLE", "Allocation quantity must be greater than 0");
        }
        targetAllocations.push({
          orderLineId: line.id,
          productId: line.productId,
          variantId: line.variantId ?? null,
          warehouseId: m.warehouseId,
          sku: line.snapshotSku,
          requestedQty: Number(line.quantity),
          allocatedQty: qty,
          backorderedQty: 0,
          reason: "Manual allocation override",
        });
      }
      const uniqueWh = new Set(targetAllocations.map((a) => a.warehouseId));
      estimatedShipments = uniqueWh.size;
    } else {
      // Use automated preview optimizer
      const preview = await this.generatePreview(tx, tenantId, orderId);
      estimatedCost = preview.estimatedCost;
      estimatedShipments = preview.estimatedShipments;

      targetAllocations = preview.allocations.map((a) => ({
        orderLineId: a.orderLineId,
        productId: a.productId,
        variantId: a.variantId ?? null,
        warehouseId: a.warehouseId,
        sku: a.sku,
        requestedQty: Number(a.requestedQty),
        allocatedQty: Number(a.allocatedQty),
        backorderedQty: Number(a.backorderedQty),
        reason: a.reason,
      }));
    }

    // 5. Deterministic row-locking on inventory_balances:
    // Extract unique (warehouseId, sku) pairs and sort ascending to prevent deadlocks
    const uniqueKeys = Array.from(
      new Set(
        targetAllocations
          .filter((a) => a.allocatedQty > 0)
          .map((a) => `${a.warehouseId}:::${a.sku}`),
      ),
    ).sort();

    // Lock and fetch current balances for all target pairs
    const lockedBalances = new Map<string, typeof schema.inventoryBalances.$inferSelect>();
    for (const key of uniqueKeys) {
      const parts = key.split(":::");
      const whId = parts[0];
      const sku = parts[1];
      if (!whId || !sku) continue;

      const [balance] = await tx
        .select()
        .from(schema.inventoryBalances)
        .where(
          and(
            eq(schema.inventoryBalances.tenantId, tenantId),
            eq(schema.inventoryBalances.warehouseId, whId),
            eq(schema.inventoryBalances.sku, sku),
          ),
        )
        .for("update");

      if (!balance) {
        // Stock record missing entirely for warehouse and SKU
        const freshPreview = await this.generatePreview(tx, tenantId, orderId);
        throw new ApiError(
          409,
          "CONFLICT",
          `No inventory record exists in warehouse ${whId} for SKU ${sku}`,
          { freshPreview },
        );
      }
      lockedBalances.set(key, balance);
    }

    // Sum required quantities per (warehouseId, sku)
    const requiredPerKey = new Map<string, number>();
    for (const alloc of targetAllocations) {
      if (alloc.allocatedQty > 0) {
        const key = `${alloc.warehouseId}:::${alloc.sku}`;
        const current = requiredPerKey.get(key) ?? 0;
        requiredPerKey.set(key, current + alloc.allocatedQty);
      }
    }

    // Verify availability
    for (const [key, required] of requiredPerKey.entries()) {
      const balance = lockedBalances.get(key)!;
      const available = Number(balance.onHandQty) - Number(balance.reservedQty);
      if (available < required) {
        // Stale stock conflict! Roll back and return 409 with safe fresh preview
        const freshPreview = await this.generatePreview(tx, tenantId, orderId);
        throw new ApiError(
          409,
          "CONFLICT",
          `Insufficient stock for SKU ${balance.sku}. Required: ${required}, Available: ${available}`,
          { freshPreview },
        );
      }
    }

    // 6. Update inventory_balances: increment reservedQty
    for (const [key, required] of requiredPerKey.entries()) {
      const balance = lockedBalances.get(key)!;
      const newReserved = (Number(balance.reservedQty) + required).toFixed(6);
      await tx
        .update(schema.inventoryBalances)
        .set({
          reservedQty: newReserved,
          revision: balance.revision + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.inventoryBalances.tenantId, tenantId),
            eq(schema.inventoryBalances.id, balance.id),
          ),
        );
    }

    // Check whether this plan has backorders
    const hasBackorders = targetAllocations.some((a) => a.backorderedQty > 0);
    const planStatus = hasBackorders ? "backordered" : "reserved";

    // 7. Insert fulfillment_plans
    const [fulfillmentPlan] = await tx
      .insert(schema.fulfillmentPlans)
      .values({
        tenantId,
        orderId: order.id,
        status: planStatus,
        revision: order.revision,
        snapshotTime: new Date(),
        estimatedCost,
        estimatedShipments,
        snapshot: { allocations: targetAllocations } as Record<string, unknown>,
        createdBy: actorId ?? null,
      })
      .returning();

    if (!fulfillmentPlan) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to create fulfillment plan");
    }

    // 8. Insert fulfillment_allocations
    const insertedAllocations = await tx
      .insert(schema.fulfillmentAllocations)
      .values(
        targetAllocations.map((a) => ({
          tenantId,
          fulfillmentPlanId: fulfillmentPlan.id,
          orderLineId: a.orderLineId,
          productId: a.productId,
          variantId: a.variantId ?? null,
          warehouseId: a.warehouseId,
          sku: a.sku,
          requestedQty: a.requestedQty.toString(),
          allocatedQty: a.allocatedQty.toString(),
          backorderedQty: a.backorderedQty.toString(),
          reason: a.reason ?? null,
        })),
      )
      .returning();

    // 9. Insert inventory_reservations for allocated stock
    const reservationsToInsert = [];
    for (let i = 0; i < targetAllocations.length; i++) {
      const alloc = targetAllocations[i];
      const persistedAlloc = insertedAllocations[i];
      if (alloc && persistedAlloc && alloc.allocatedQty > 0) {
        reservationsToInsert.push({
          tenantId,
          warehouseId: alloc.warehouseId,
          sku: alloc.sku,
          quantity: alloc.allocatedQty.toString(),
          orderId: order.id,
          orderLineId: alloc.orderLineId,
          fulfillmentAllocationId: persistedAlloc.id,
          status: "active",
        });
      }
    }

    let insertedReservations: (typeof schema.inventoryReservations.$inferSelect)[] = [];
    if (reservationsToInsert.length > 0) {
      insertedReservations = await tx
        .insert(schema.inventoryReservations)
        .values(reservationsToInsert)
        .returning();
    }

    // 10. Update order status and revision
    const newOrderStatus = hasBackorders ? "backordered" : "stockReserved";
    const [updatedOrder] = await tx
      .update(schema.orders)
      .set({
        status: newOrderStatus,
        revision: order.revision + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.id, order.id)))
      .returning();

    if (!fulfillmentPlan) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to create fulfillment plan");
    }

    if (!updatedOrder) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to update order");
    }

    // 11. Write audit & outbox
    await writeAuditEvent(tx, {
      tenantId,
      actorId,
      action: "fulfillment.confirmed",
      entityType: "fulfillment_plan",
      entityId: fulfillmentPlan.id,
      detail: {
        orderId: order.id,
        orderNumber: order.number,
        planStatus,
        orderStatus: newOrderStatus,
        revision: updatedOrder.revision,
        reservationsCount: insertedReservations.length,
      },
      requestId,
    });

    await tx.insert(schema.outboxEvents).values({
      tenantId,
      aggregateType: "order",
      aggregateId: order.id,
      eventType: "inventory.changed",
      payload: {
        orderId: order.id,
        planId: fulfillmentPlan.id,
        status: newOrderStatus,
      },
    });

    await tx.insert(schema.outboxEvents).values({
      tenantId,
      aggregateType: "order",
      aggregateId: order.id,
      eventType: "order.updated",
      payload: {
        orderId: order.id,
        status: newOrderStatus,
        revision: updatedOrder.revision,
      },
    });

    return {
      order: updatedOrder,
      fulfillmentPlan: {
        ...fulfillmentPlan,
        allocations: insertedAllocations,
      },
      reservations: insertedReservations,
    };
  }

  /**
   * Idempotent shipment command.
   * Converts active reserved stock into immutable shipped movement ledger entries.
   * Updates reservation status to 'shipped' and marks order partiallyShipped or shipped.
   */
  static async createShipment(
    tx: Db,
    tenantId: string,
    orderId: string,
    input: CreateShipmentInput,
  ) {
    const {
      warehouseId,
      reservationIds,
      items,
      carrier,
      trackingNumber,
      notes,
      actorId,
      requestId,
    } = input;

    // 1. Lock the order
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.id, orderId)))
      .for("update");

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "Order not found");
    }

    if (["shipped", "delivered", "cancelled"].includes(order.status)) {
      throw new ApiError(
        422,
        "UNPROCESSABLE",
        `Order in status '${order.status}' cannot accept shipments`,
      );
    }

    // 2. Find reservations to ship
    const resConditions = [
      eq(schema.inventoryReservations.tenantId, tenantId),
      eq(schema.inventoryReservations.orderId, orderId),
      eq(schema.inventoryReservations.warehouseId, warehouseId),
      eq(schema.inventoryReservations.status, "active"),
    ];

    if (reservationIds && reservationIds.length > 0) {
      resConditions.push(inArray(schema.inventoryReservations.id, reservationIds));
    }

    const availableReservations = await tx
      .select()
      .from(schema.inventoryReservations)
      .where(and(...resConditions))
      .for("update");

    if (availableReservations.length === 0) {
      throw new ApiError(
        422,
        "UNPROCESSABLE",
        "No active reservations found for the given warehouse to ship",
      );
    }

    // Build map of ship quantity per reservation
    const shipQtyMap = new Map<string, number>();
    if (items && items.length > 0) {
      for (const item of items) {
        shipQtyMap.set(item.reservationId, Number(item.quantity));
      }
    } else {
      for (const res of availableReservations) {
        shipQtyMap.set(res.id, Number(res.quantity));
      }
    }

    // Sort warehouse/sku pairs deterministically to lock inventory balances
    const uniqueSkus = Array.from(new Set(availableReservations.map((r) => r.sku))).sort();
    const lockedBalances = new Map<string, typeof schema.inventoryBalances.$inferSelect>();

    for (const sku of uniqueSkus) {
      const [balance] = await tx
        .select()
        .from(schema.inventoryBalances)
        .where(
          and(
            eq(schema.inventoryBalances.tenantId, tenantId),
            eq(schema.inventoryBalances.warehouseId, warehouseId),
            eq(schema.inventoryBalances.sku, sku),
          ),
        )
        .for("update");

      if (!balance) {
        throw new ApiError(422, "UNPROCESSABLE", `Balance not found for SKU ${sku} in warehouse`);
      }
      lockedBalances.set(sku, balance);
    }

    // 3. Create shipment record
    const shipmentNumber = generateShipmentNumber();
    const [shipment] = await tx
      .insert(schema.shipments)
      .values({
        tenantId,
        orderId: order.id,
        warehouseId,
        number: shipmentNumber,
        status: "shipped",
        carrier: carrier ?? null,
        trackingNumber: trackingNumber ?? null,
        shippedAt: new Date(),
        notes: notes ?? null,
        createdBy: actorId ?? null,
      })
      .returning();

    if (!shipment) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to create shipment");
    }

    // 4. Process each reservation being shipped
    const shipmentLinesToInsert = [];

    for (const res of availableReservations) {
      const shipQty = shipQtyMap.get(res.id);
      if (!shipQty || shipQty <= 0) continue;

      const balance = lockedBalances.get(res.sku)!;
      const newOnHand = Math.max(0, Number(balance.onHandQty) - shipQty).toFixed(6);
      const newReserved = Math.max(0, Number(balance.reservedQty) - shipQty).toFixed(6);

      // Decrement on_hand and reserved
      await tx
        .update(schema.inventoryBalances)
        .set({
          onHandQty: newOnHand,
          reservedQty: newReserved,
          revision: balance.revision + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.inventoryBalances.tenantId, tenantId),
            eq(schema.inventoryBalances.id, balance.id),
          ),
        );

      // Insert immutable inventory movement ledger row (negative deltaQty)
      await tx.insert(schema.inventoryMovements).values({
        tenantId,
        warehouseId,
        sku: res.sku,
        deltaQty: (-shipQty).toFixed(6),
        reason: `Shipment ${shipment.number} for Order ${order.number}`,
      });

      // Update reservation status: if completely shipped -> 'shipped'
      const resQty = Number(res.quantity);
      if (shipQty >= resQty) {
        await tx
          .update(schema.inventoryReservations)
          .set({
            status: "shipped",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.inventoryReservations.tenantId, tenantId),
              eq(schema.inventoryReservations.id, res.id),
            ),
          );
      } else {
        // Partial reservation shipment: decrement existing reservation
        await tx
          .update(schema.inventoryReservations)
          .set({
            quantity: (resQty - shipQty).toFixed(6),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.inventoryReservations.tenantId, tenantId),
              eq(schema.inventoryReservations.id, res.id),
            ),
          );
      }

      shipmentLinesToInsert.push({
        tenantId,
        shipmentId: shipment.id,
        orderLineId: res.orderLineId!,
        reservationId: res.id,
        sku: res.sku,
        quantity: shipQty.toString(),
      });
    }

    const insertedShipmentLines = await tx
      .insert(schema.shipmentLines)
      .values(shipmentLinesToInsert)
      .returning();

    // 5. Check remaining active reservations for this order
    const remainingActive = await tx
      .select({ count: sql<number>`count(*)` })
      .from(schema.inventoryReservations)
      .where(
        and(
          eq(schema.inventoryReservations.tenantId, tenantId),
          eq(schema.inventoryReservations.orderId, order.id),
          eq(schema.inventoryReservations.status, "active"),
        ),
      );

    const hasRemainingReservations = Number(remainingActive[0]?.count ?? 0) > 0;
    const newOrderStatus = hasRemainingReservations ? "partiallyShipped" : "shipped";

    const [updatedOrder] = await tx
      .update(schema.orders)
      .set({
        status: newOrderStatus,
        revision: order.revision + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.id, order.id)))
      .returning();

    if (!shipment) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to create shipment");
    }

    if (!updatedOrder) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to update order status");
    }

    // 6. Write audit & outbox
    await writeAuditEvent(tx, {
      tenantId,
      actorId,
      action: "shipment.created",
      entityType: "shipment",
      entityId: shipment.id,
      detail: {
        orderId: order.id,
        shipmentNumber: shipment.number,
        warehouseId,
        linesCount: insertedShipmentLines.length,
        orderStatus: newOrderStatus,
      },
      requestId,
    });

    await tx.insert(schema.outboxEvents).values({
      tenantId,
      aggregateType: "shipment",
      aggregateId: shipment.id,
      eventType: "shipment.updated",
      payload: {
        shipmentId: shipment.id,
        orderId: order.id,
        status: shipment.status,
      },
    });

    await tx.insert(schema.outboxEvents).values({
      tenantId,
      aggregateType: "order",
      aggregateId: order.id,
      eventType: "order.updated",
      payload: {
        orderId: order.id,
        status: newOrderStatus,
        revision: updatedOrder.revision,
      },
    });

    await BillingService.issueOneTimeInvoiceOnShipment(tx, {
      tenantId,
      orderId: order.id,
      actorId,
      requestId,
    });

    return {
      order: updatedOrder,
      shipment: {
        ...shipment,
        lines: insertedShipmentLines,
      },
    };
  }

  /**
   * Replan backorders:
   * Generates a new plan from live inventory for unreserved items.
   * Never mutates historical allocations/shipments.
   */
  static async replanBackorder(
    tx: Db,
    tenantId: string,
    orderId: string,
    actorId?: string | null,
    requestId?: string | null,
  ) {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.id, orderId)))
      .for("update");

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "Order not found");
    }

    // Generate fresh preview for order
    const preview = await this.generatePreview(tx, tenantId, orderId);

    // Write audit event
    await writeAuditEvent(tx, {
      tenantId,
      actorId,
      action: "fulfillment.backorder_replanned",
      entityType: "order",
      entityId: order.id,
      detail: {
        estimatedShipments: preview.estimatedShipments,
        estimatedCost: preview.estimatedCost,
        backordersCount: preview.backorders.length,
      },
      requestId,
    });

    return preview;
  }
}
