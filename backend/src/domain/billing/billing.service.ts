import { eq, and, desc, gte, lte } from "drizzle-orm";
import type { Db } from "../../db/connection.js";
import * as schema from "../../db/schema/index.js";
import { ApiError } from "../../shared/errors.js";
import { writeAuditEvent } from "../../shared/audit.js";
import { calcTotals, calcLine, parseMoney, formatMoney } from "../../shared/money.js";
import { generateInvoiceNumber } from "./invoiceNumber.js";
import {
  computeBillingPeriod,
  computeDueAt,
  formatDateOnly,
  type BillingInterval,
  type Clock,
  systemClock,
} from "./schedule.js";
import {
  computePeriodAmount,
  computeProration,
  computeCancellationCredit,
  type SubscriptionTerms,
} from "./proration.js";
import { getBillingCapabilities } from "./capabilities.js";

export type { Clock, BillingInterval };

function termsFromSubscription(sub: typeof schema.subscriptions.$inferSelect): SubscriptionTerms {
  return {
    quantity: sub.quantity,
    unitPrice: sub.snapshotUnitPrice,
    discountPct: sub.discountPct,
    taxRatePct: sub.snapshotTaxRatePct,
  };
}

function snapshotTerms(
  terms: SubscriptionTerms & { billingInterval?: string; planCode?: string | null },
) {
  return JSON.stringify(terms);
}

async function emitBillingOutbox(
  tx: Db,
  tenantId: string,
  aggregateType: "subscription" | "invoice",
  aggregateId: string,
  eventType: "subscription.updated" | "invoice.updated",
  payload: Record<string, unknown>,
) {
  await tx.insert(schema.outboxEvents).values({
    tenantId,
    aggregateType,
    aggregateId,
    eventType,
    payload,
  });
}

export class BillingService {
  /**
   * Idempotent billing bootstrap after order conversion.
   * Creates draft one-time invoice (if any one_time lines) and active subscriptions for recurring lines.
   */
  static async initializeBillingForOrder(
    tx: Db,
    input: {
      tenantId: string;
      orderId: string;
      actorId?: string | null;
      requestId?: string | null;
      clock?: Clock;
    },
  ) {
    const { tenantId, orderId, actorId, requestId } = input;
    const clock = input.clock ?? systemClock;
    const now = clock.now();

    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.id, orderId)))
      .limit(1);

    if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found");

    const lines = await tx
      .select()
      .from(schema.orderLines)
      .where(and(eq(schema.orderLines.tenantId, tenantId), eq(schema.orderLines.orderId, orderId)));

    const oneTimeLines = lines.filter((l) => l.billingType === "one_time");
    const recurringLines = lines.filter((l) => l.billingType === "recurring");

    let oneTimeInvoice: typeof schema.invoices.$inferSelect | null = null;
    let invoiceLines: (typeof schema.invoiceLines.$inferSelect)[] = [];
    const createdSubscriptions: (typeof schema.subscriptions.$inferSelect)[] = [];

    // Draft one-time invoice (issued on first shipment)
    if (oneTimeLines.length > 0) {
      const [existingInvoice] = await tx
        .select()
        .from(schema.invoices)
        .where(
          and(
            eq(schema.invoices.tenantId, tenantId),
            eq(schema.invoices.orderId, orderId),
            eq(schema.invoices.invoiceType, "one_time"),
          ),
        )
        .limit(1);

      if (existingInvoice) {
        oneTimeInvoice = existingInvoice;
        invoiceLines = await tx
          .select()
          .from(schema.invoiceLines)
          .where(
            and(
              eq(schema.invoiceLines.tenantId, tenantId),
              eq(schema.invoiceLines.invoiceId, existingInvoice.id),
            ),
          );
      } else {
        const calcLines = oneTimeLines.map((l) =>
          calcLine({
            quantity: l.quantity,
            unitPrice: l.snapshotUnitPrice,
            discountPct: l.discountPct,
            taxRatePct: l.snapshotTaxRatePct,
            unitCost: "0",
          }),
        );
        const totals = calcTotals({
          lines: calcLines.map((c) => ({
            subtotal: c.subtotal,
            discountAmount: c.discountAmount,
            net: c.net,
            tax: c.tax,
            total: c.total,
            margin: "0",
          })),
        });

        let invoiceNumber = generateInvoiceNumber();
        for (let i = 0; i < 5; i++) {
          const [dup] = await tx
            .select({ id: schema.invoices.id })
            .from(schema.invoices)
            .where(
              and(
                eq(schema.invoices.tenantId, tenantId),
                eq(schema.invoices.number, invoiceNumber),
              ),
            )
            .limit(1);
          if (!dup) break;
          invoiceNumber = generateInvoiceNumber();
        }

        const [inserted] = await tx
          .insert(schema.invoices)
          .values({
            tenantId,
            number: invoiceNumber,
            orderId: order.id,
            customerId: order.customerId,
            invoiceType: "one_time",
            status: "draft",
            currency: order.currency,
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
            netTotal: totals.netTotal,
            taxTotal: totals.taxTotal,
            grandTotal: totals.grandTotal,
            balance: totals.grandTotal,
          })
          .returning();

        if (!inserted)
          throw new ApiError(500, "INTERNAL_ERROR", "Failed to create one-time invoice");

        oneTimeInvoice = inserted;
        const lineRows = oneTimeLines.map((l, idx) => {
          const c = calcLines[idx]!;
          return {
            tenantId,
            invoiceId: inserted.id,
            orderLineId: l.id,
            lineNumber: idx + 1,
            description: l.snapshotName,
            quantity: l.quantity,
            unitPrice: l.snapshotUnitPrice,
            discountPct: l.discountPct,
            taxRatePct: l.snapshotTaxRatePct,
            lineSubtotal: c.subtotal,
            lineDiscount: c.discountAmount,
            lineNet: c.net,
            lineTax: c.tax,
            lineTotal: c.total,
            immutable: 0,
          };
        });
        invoiceLines = await tx.insert(schema.invoiceLines).values(lineRows).returning();

        await writeAuditEvent(tx, {
          tenantId,
          actorId,
          action: "invoice.created",
          entityType: "invoice",
          entityId: inserted.id,
          detail: {
            invoiceNumber: inserted.number,
            orderId,
            status: "draft",
            invoiceType: "one_time",
          },
          requestId,
        });

        await emitBillingOutbox(tx, tenantId, "invoice", inserted.id, "invoice.updated", {
          invoiceId: inserted.id,
          status: inserted.status,
          revision: inserted.revision,
        });
      }
    }

    // Active subscriptions for recurring lines
    for (const line of recurringLines) {
      const [existingSub] = await tx
        .select()
        .from(schema.subscriptions)
        .where(
          and(
            eq(schema.subscriptions.tenantId, tenantId),
            eq(schema.subscriptions.orderLineId, line.id),
          ),
        )
        .limit(1);

      if (existingSub) {
        createdSubscriptions.push(existingSub);
        continue;
      }

      if (!line.subscriptionPlanId) {
        throw new ApiError(422, "UNPROCESSABLE", "Recurring order line missing subscription plan");
      }

      const [plan] = await tx
        .select()
        .from(schema.subscriptionPlans)
        .where(
          and(
            eq(schema.subscriptionPlans.tenantId, tenantId),
            eq(schema.subscriptionPlans.id, line.subscriptionPlanId),
          ),
        )
        .limit(1);

      if (!plan)
        throw new ApiError(422, "UNPROCESSABLE", "Subscription plan not found for recurring line");

      const anchorDate = formatDateOnly(now);
      const interval = plan.billingInterval as BillingInterval;
      const period = computeBillingPeriod(anchorDate, interval, now);
      const periodAmt = computePeriodAmount({
        quantity: line.quantity,
        unitPrice: line.snapshotUnitPrice,
        discountPct: line.discountPct,
        taxRatePct: line.snapshotTaxRatePct,
      });

      const [sub] = await tx
        .insert(schema.subscriptions)
        .values({
          tenantId,
          orderId: order.id,
          orderLineId: line.id,
          customerId: order.customerId,
          subscriptionPlanId: plan.id,
          status: "active",
          billingInterval: interval,
          billingAnchorDate: anchorDate,
          billingTimezone: "UTC",
          quantity: line.quantity,
          discountPct: line.discountPct,
          snapshotPlanCode: plan.code,
          snapshotPlanName: plan.name,
          snapshotName: line.snapshotName,
          snapshotSku: line.snapshotSku,
          snapshotUnit: line.snapshotUnit,
          snapshotUnitPrice: line.snapshotUnitPrice,
          snapshotTaxRatePct: line.snapshotTaxRatePct,
          snapshotCurrency: line.snapshotCurrency,
          periodUnitNet: periodAmt.net,
          periodUnitTax: periodAmt.tax,
          periodUnitTotal: periodAmt.total,
          currentPeriodStart: period.periodStart,
          currentPeriodEnd: period.periodEnd,
          nextBillAt: period.nextBillAt,
          cancelPolicy: "credit_remaining",
        })
        .returning();

      if (!sub) throw new ApiError(500, "INTERNAL_ERROR", "Failed to create subscription");

      createdSubscriptions.push(sub);

      const jobKey = `recurring:${sub.id}:${period.nextBillAt.toISOString()}`;
      await tx
        .insert(schema.billingJobs)
        .values({
          tenantId,
          subscriptionId: sub.id,
          dueAt: period.nextBillAt,
          status: "pending",
          idempotencyKey: jobKey,
        })
        .onConflictDoNothing();

      await writeAuditEvent(tx, {
        tenantId,
        actorId,
        action: "subscription.created",
        entityType: "subscription",
        entityId: sub.id,
        detail: { orderId, orderLineId: line.id, nextBillAt: sub.nextBillAt },
        requestId,
      });

      await emitBillingOutbox(tx, tenantId, "subscription", sub.id, "subscription.updated", {
        subscriptionId: sub.id,
        status: sub.status,
        revision: sub.revision,
      });
    }

    return {
      oneTimeInvoice,
      invoiceLines,
      subscriptions: createdSubscriptions,
      capabilities: getBillingCapabilities(),
    };
  }

  /**
   * Issue draft one-time invoice when first shipment occurs (Net-30 due).
   */
  static async issueOneTimeInvoiceOnShipment(
    tx: Db,
    input: {
      tenantId: string;
      orderId: string;
      actorId?: string | null;
      requestId?: string | null;
      clock?: Clock;
    },
  ) {
    const { tenantId, orderId, actorId, requestId } = input;
    const clock = input.clock ?? systemClock;
    const now = clock.now();

    const [invoice] = await tx
      .select()
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.tenantId, tenantId),
          eq(schema.invoices.orderId, orderId),
          eq(schema.invoices.invoiceType, "one_time"),
        ),
      )
      .limit(1);

    if (!invoice || invoice.status !== "draft") {
      return { invoice, issued: false };
    }

    const dueAt = computeDueAt(now, 30);

    const [updated] = await tx
      .update(schema.invoices)
      .set({
        status: "issued",
        issuedAt: now,
        dueAt,
        revision: invoice.revision + 1,
        updatedAt: now,
      })
      .where(and(eq(schema.invoices.tenantId, tenantId), eq(schema.invoices.id, invoice.id)))
      .returning();

    await tx
      .update(schema.invoiceLines)
      .set({ immutable: 1 })
      .where(
        and(
          eq(schema.invoiceLines.tenantId, tenantId),
          eq(schema.invoiceLines.invoiceId, invoice.id),
        ),
      );

    await writeAuditEvent(tx, {
      tenantId,
      actorId,
      action: "invoice.issued",
      entityType: "invoice",
      entityId: invoice.id,
      detail: { orderId, issuedAt: now.toISOString(), dueAt: dueAt.toISOString() },
      requestId,
    });

    if (updated) {
      await emitBillingOutbox(tx, tenantId, "invoice", updated.id, "invoice.updated", {
        invoiceId: updated.id,
        status: updated.status,
        revision: updated.revision,
      });
    }

    return { invoice: updated ?? invoice, issued: true };
  }

  static async listSubscriptions(
    tx: Db,
    filters: { tenantId: string; status?: string; customerId?: string; limit?: number },
  ) {
    const { tenantId, status, customerId, limit = 50 } = filters;
    const conditions = [eq(schema.subscriptions.tenantId, tenantId)];
    if (status) conditions.push(eq(schema.subscriptions.status, status));
    if (customerId) conditions.push(eq(schema.subscriptions.customerId, customerId));

    const rows = await tx
      .select()
      .from(schema.subscriptions)
      .where(and(...conditions))
      .orderBy(desc(schema.subscriptions.createdAt))
      .limit(limit);

    return { subscriptions: rows, capabilities: getBillingCapabilities() };
  }

  static async getSubscriptionById(tx: Db, tenantId: string, subscriptionId: string) {
    const [sub] = await tx
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.tenantId, tenantId),
          eq(schema.subscriptions.id, subscriptionId),
        ),
      )
      .limit(1);

    if (!sub) throw new ApiError(404, "NOT_FOUND", "Subscription not found");

    const changes = await tx
      .select()
      .from(schema.subscriptionChanges)
      .where(
        and(
          eq(schema.subscriptionChanges.tenantId, tenantId),
          eq(schema.subscriptionChanges.subscriptionId, subscriptionId),
        ),
      )
      .orderBy(desc(schema.subscriptionChanges.createdAt));

    return { subscription: sub, changes, capabilities: getBillingCapabilities() };
  }

  static previewSubscriptionChange(
    sub: typeof schema.subscriptions.$inferSelect,
    input: {
      quantity?: string;
      discountPct?: string;
      unitPrice?: string;
      effectiveAt: Date;
    },
  ) {
    if (sub.status !== "active") {
      throw new ApiError(422, "UNPROCESSABLE", "Subscription is not active");
    }

    const oldTerms = termsFromSubscription(sub);
    const newTerms: SubscriptionTerms = {
      quantity: input.quantity ?? sub.quantity,
      unitPrice: input.unitPrice ?? sub.snapshotUnitPrice,
      discountPct: input.discountPct ?? sub.discountPct,
      taxRatePct: sub.snapshotTaxRatePct,
    };

    const proration = computeProration(
      oldTerms,
      newTerms,
      sub.currentPeriodStart,
      sub.currentPeriodEnd,
      input.effectiveAt,
    );

    const newPeriodAmt = computePeriodAmount(newTerms);

    return {
      subscriptionId: sub.id,
      effectiveAt: input.effectiveAt.toISOString(),
      previousTerms: oldTerms,
      newTerms,
      proration,
      nextPeriodAmount: newPeriodAmt,
      currentPeriod: {
        start: sub.currentPeriodStart.toISOString(),
        end: sub.currentPeriodEnd.toISOString(),
      },
    };
  }

  static async applySubscriptionChange(
    tx: Db,
    input: {
      tenantId: string;
      subscriptionId: string;
      quantity?: string;
      discountPct?: string;
      unitPrice?: string;
      effectiveAt: Date;
      ifMatchRevision: number;
      actorId?: string | null;
      requestId?: string | null;
    },
  ) {
    const { tenantId, subscriptionId, effectiveAt, ifMatchRevision, actorId, requestId } = input;

    const [sub] = await tx
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.tenantId, tenantId),
          eq(schema.subscriptions.id, subscriptionId),
        ),
      )
      .for("update");

    if (!sub) throw new ApiError(404, "NOT_FOUND", "Subscription not found");
    if (sub.revision !== ifMatchRevision) {
      throw new ApiError(412, "VERSION_CONFLICT", "Subscription revision mismatch");
    }

    const preview = this.previewSubscriptionChange(sub, input);
    const newPeriodAmt = preview.nextPeriodAmount;

    let adjustmentId: string | null = null;
    if (preview.proration.direction !== "none") {
      const adjType = preview.proration.direction === "debit" ? "debit" : "credit";
      const [adj] = await tx
        .insert(schema.adjustments)
        .values({
          tenantId,
          subscriptionId: sub.id,
          adjustmentType: adjType,
          amount: preview.proration.totalDelta,
          currency: sub.snapshotCurrency,
          reason: `Proration for subscription change effective ${effectiveAt.toISOString()}`,
        })
        .returning();
      adjustmentId = adj?.id ?? null;
    }

    const [updated] = await tx
      .update(schema.subscriptions)
      .set({
        quantity: preview.newTerms.quantity,
        discountPct: preview.newTerms.discountPct,
        snapshotUnitPrice: preview.newTerms.unitPrice,
        periodUnitNet: newPeriodAmt.net,
        periodUnitTax: newPeriodAmt.tax,
        periodUnitTotal: newPeriodAmt.total,
        revision: sub.revision + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.subscriptions.tenantId, tenantId),
          eq(schema.subscriptions.id, subscriptionId),
        ),
      )
      .returning();

    const [change] = await tx
      .insert(schema.subscriptionChanges)
      .values({
        tenantId,
        subscriptionId: sub.id,
        changeType: input.quantity ? "quantity" : input.discountPct ? "discount" : "plan",
        effectiveAt,
        previousSnapshot: snapshotTerms({
          ...preview.previousTerms,
          billingInterval: sub.billingInterval,
        }),
        newSnapshot: snapshotTerms({ ...preview.newTerms, billingInterval: sub.billingInterval }),
        prorationNet: preview.proration.netDelta,
        prorationTax: preview.proration.taxDelta,
        prorationTotal: preview.proration.totalDelta,
        adjustmentId,
        createdBy: actorId ?? null,
      })
      .returning();

    await writeAuditEvent(tx, {
      tenantId,
      actorId,
      action: "subscription.changed",
      entityType: "subscription",
      entityId: sub.id,
      detail: { changeId: change?.id, proration: preview.proration },
      requestId,
    });

    if (updated) {
      await emitBillingOutbox(tx, tenantId, "subscription", updated.id, "subscription.updated", {
        subscriptionId: updated.id,
        status: updated.status,
        revision: updated.revision,
      });
    }

    return { subscription: updated, change, adjustmentId, preview };
  }

  static previewCancellation(sub: typeof schema.subscriptions.$inferSelect, effectiveAt: Date) {
    if (sub.status !== "active") {
      throw new ApiError(422, "UNPROCESSABLE", "Subscription is not active");
    }

    const credit = computeCancellationCredit(
      termsFromSubscription(sub),
      sub.cancelPolicy as "credit_remaining" | "no_refund" | "charge_remaining",
      sub.currentPeriodStart,
      sub.currentPeriodEnd,
      effectiveAt,
    );

    return {
      subscriptionId: sub.id,
      effectiveAt: effectiveAt.toISOString(),
      credit,
      cancelPolicy: sub.cancelPolicy,
    };
  }

  static async cancelSubscription(
    tx: Db,
    input: {
      tenantId: string;
      subscriptionId: string;
      effectiveAt: Date;
      reason?: string;
      ifMatchRevision: number;
      actorId?: string | null;
      requestId?: string | null;
    },
  ) {
    const { tenantId, subscriptionId, effectiveAt, reason, ifMatchRevision, actorId, requestId } =
      input;

    const [sub] = await tx
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.tenantId, tenantId),
          eq(schema.subscriptions.id, subscriptionId),
        ),
      )
      .for("update");

    if (!sub) throw new ApiError(404, "NOT_FOUND", "Subscription not found");
    if (sub.revision !== ifMatchRevision) {
      throw new ApiError(412, "VERSION_CONFLICT", "Subscription revision mismatch");
    }
    if (sub.status === "cancelled") {
      return { subscription: sub, credit: null, isExisting: true };
    }

    const preview = this.previewCancellation(sub, effectiveAt);
    let adjustmentId: string | null = null;

    if (preview.credit.direction === "credit") {
      const [adj] = await tx
        .insert(schema.adjustments)
        .values({
          tenantId,
          subscriptionId: sub.id,
          adjustmentType: "refund",
          amount: preview.credit.creditTotal,
          currency: sub.snapshotCurrency,
          reason: reason ?? "Subscription cancellation credit",
        })
        .returning();
      adjustmentId = adj?.id ?? null;
    }

    const now = new Date();
    const [updated] = await tx
      .update(schema.subscriptions)
      .set({
        status: "cancelled",
        cancelEffectiveAt: effectiveAt,
        cancelledAt: now,
        cancelReason: reason ?? null,
        revision: sub.revision + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.subscriptions.tenantId, tenantId),
          eq(schema.subscriptions.id, subscriptionId),
        ),
      )
      .returning();

    await tx.insert(schema.subscriptionChanges).values({
      tenantId,
      subscriptionId: sub.id,
      changeType: "cancel",
      effectiveAt,
      previousSnapshot: snapshotTerms({
        ...termsFromSubscription(sub),
        billingInterval: sub.billingInterval,
      }),
      newSnapshot: JSON.stringify({ status: "cancelled" }),
      prorationNet: preview.credit.creditNet,
      prorationTax: preview.credit.creditTax,
      prorationTotal: preview.credit.creditTotal,
      adjustmentId,
      createdBy: actorId ?? null,
    });

    await writeAuditEvent(tx, {
      tenantId,
      actorId,
      action: "subscription.cancelled",
      entityType: "subscription",
      entityId: sub.id,
      detail: { effectiveAt: effectiveAt.toISOString(), credit: preview.credit },
      requestId,
    });

    if (updated) {
      await emitBillingOutbox(tx, tenantId, "subscription", updated.id, "subscription.updated", {
        subscriptionId: updated.id,
        status: updated.status,
        revision: updated.revision,
      });
    }

    return { subscription: updated, credit: preview.credit, adjustmentId, isExisting: false };
  }

  static async listInvoices(
    tx: Db,
    filters: {
      tenantId: string;
      status?: string;
      customerId?: string;
      orderId?: string;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    },
  ) {
    const { tenantId, status, customerId, orderId, fromDate, toDate, limit = 50 } = filters;
    const conditions = [eq(schema.invoices.tenantId, tenantId)];
    if (status) conditions.push(eq(schema.invoices.status, status));
    if (customerId) conditions.push(eq(schema.invoices.customerId, customerId));
    if (orderId) conditions.push(eq(schema.invoices.orderId, orderId));
    if (fromDate) conditions.push(gte(schema.invoices.createdAt, fromDate));
    if (toDate) conditions.push(lte(schema.invoices.createdAt, toDate));

    const rows = await tx
      .select()
      .from(schema.invoices)
      .where(and(...conditions))
      .orderBy(desc(schema.invoices.createdAt))
      .limit(limit);

    return { invoices: rows, capabilities: getBillingCapabilities() };
  }

  static async getInvoiceById(tx: Db, tenantId: string, invoiceId: string) {
    const [invoice] = await tx
      .select()
      .from(schema.invoices)
      .where(and(eq(schema.invoices.tenantId, tenantId), eq(schema.invoices.id, invoiceId)))
      .limit(1);

    if (!invoice) throw new ApiError(404, "NOT_FOUND", "Invoice not found");

    const lines = await tx
      .select()
      .from(schema.invoiceLines)
      .where(
        and(
          eq(schema.invoiceLines.tenantId, tenantId),
          eq(schema.invoiceLines.invoiceId, invoiceId),
        ),
      )
      .orderBy(schema.invoiceLines.lineNumber);

    const adjustments = await tx
      .select()
      .from(schema.adjustments)
      .where(
        and(eq(schema.adjustments.tenantId, tenantId), eq(schema.adjustments.invoiceId, invoiceId)),
      );

    const payments = await tx
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.tenantId, tenantId), eq(schema.payments.invoiceId, invoiceId)))
      .orderBy(desc(schema.payments.paidAt));

    return { invoice, lines, adjustments, payments, capabilities: getBillingCapabilities() };
  }

  static async recordPayment(
    tx: Db,
    input: {
      tenantId: string;
      invoiceId: string;
      amount: string;
      paidAt: Date;
      reference?: string;
      method?: string;
      actorId?: string | null;
      requestId?: string | null;
    },
  ) {
    const { tenantId, invoiceId, amount, paidAt, reference, method, actorId, requestId } = input;

    const [invoice] = await tx
      .select()
      .from(schema.invoices)
      .where(and(eq(schema.invoices.tenantId, tenantId), eq(schema.invoices.id, invoiceId)))
      .for("update");

    if (!invoice) throw new ApiError(404, "NOT_FOUND", "Invoice not found");
    if (invoice.status === "draft") {
      throw new ApiError(422, "UNPROCESSABLE", "Cannot record payment against draft invoice");
    }
    if (invoice.status === "paid") {
      throw new ApiError(422, "UNPROCESSABLE", "Invoice is already paid");
    }
    if (invoice.status === "void") {
      throw new ApiError(422, "UNPROCESSABLE", "Invoice is void");
    }

    const payAmt = parseMoney(amount);
    const bal = parseMoney(invoice.balance);
    if (payAmt <= 0n) throw new ApiError(400, "BAD_REQUEST", "Payment amount must be positive");
    if (payAmt > bal) {
      throw new ApiError(422, "UNPROCESSABLE", "Payment exceeds invoice balance");
    }

    const [payment] = await tx
      .insert(schema.payments)
      .values({
        tenantId,
        invoiceId,
        amount,
        currency: invoice.currency,
        method: method ?? "manual",
        reference: reference ?? null,
        paidAt,
        recordedBy: actorId ?? null,
      })
      .returning();

    const newBalance = formatMoney(bal - payAmt);
    const newStatus = newBalance === "0.000000" ? "paid" : "partial";

    const [updated] = await tx
      .update(schema.invoices)
      .set({
        balance: newBalance,
        status: newStatus,
        paidAt: newStatus === "paid" ? paidAt : invoice.paidAt,
        revision: invoice.revision + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.invoices.tenantId, tenantId), eq(schema.invoices.id, invoiceId)))
      .returning();

    await writeAuditEvent(tx, {
      tenantId,
      actorId,
      action: "invoice.paymentRecorded",
      entityType: "invoice",
      entityId: invoiceId,
      detail: { paymentId: payment?.id, amount, newBalance, status: newStatus },
      requestId,
    });

    if (updated) {
      await emitBillingOutbox(tx, tenantId, "invoice", updated.id, "invoice.updated", {
        invoiceId: updated.id,
        status: updated.status,
        revision: updated.revision,
      });
    }

    return { payment, invoice: updated };
  }
}
