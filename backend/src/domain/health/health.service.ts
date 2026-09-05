import { sql, eq, and, inArray, desc } from "drizzle-orm";
import type { Db } from "../../db/connection.js";
import {
  alerts,
  notifications,
  quotes,
  orders,
  invoices,
  outboxEvents,
} from "../../db/schema/index.js";
import { writeAuditEvent } from "../../shared/audit.js";
import { ApiError } from "../../shared/errors.js";

export interface DiscountStats {
  sampleCount: number;
  mean: number;
  stddev: number;
}

/**
 * Pure statistical helper to calculate mean and sample standard deviation of discounts.
 */
export function calculateDiscountStats(discounts: number[]): DiscountStats {
  const sampleCount = discounts.length;
  if (sampleCount === 0) {
    return { sampleCount: 0, mean: 0, stddev: 0 };
  }
  const mean = discounts.reduce((acc, v) => acc + v, 0) / sampleCount;
  if (sampleCount === 1) {
    return { sampleCount: 1, mean, stddev: 0 };
  }
  const variance = discounts.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (sampleCount - 1);
  const stddev = Math.sqrt(variance);
  return { sampleCount, mean, stddev };
}

/**
 * Pure statistical helper to detect if a discount is an explainable anomaly.
 * Requires minimum sample size of 5 quotes.
 */
export function evaluateDiscountAnomaly(
  discountPct: number,
  stats: DiscountStats,
  minSample = 5,
): { isAnomaly: boolean; confidence: number; reason?: string } {
  if (stats.sampleCount < minSample) {
    return { isAnomaly: false, confidence: 0 };
  }

  const effectiveStddev = stats.stddev > 0.5 ? stats.stddev : 2.0;
  const threshold = Math.max(stats.mean + 2 * effectiveStddev, 15.0);

  if (discountPct > threshold) {
    const deviation = discountPct - stats.mean;
    // Confidence score between 70% and 99% based on sample size and deviation
    const sampleFactor = Math.min(10, (stats.sampleCount - minSample) * 2);
    const deviationFactor = Math.min(19, (deviation / effectiveStddev) * 5);
    const confidence = Math.min(99, Math.round(70 + sampleFactor + deviationFactor));

    return {
      isAnomaly: true,
      confidence,
      reason: `Discount of ${discountPct.toFixed(1)}% exceeds the threshold (${threshold.toFixed(1)}%) based on ${stats.sampleCount} benchmark deals (mean: ${stats.mean.toFixed(1)}%, stddev: ${effectiveStddev.toFixed(1)}%).`,
    };
  }

  return { isAnomaly: false, confidence: 0 };
}

export class HealthService {
  /**
   * Scans tenant resources and detects/persists deal health alerts:
   * 1. Stalled quotes (>14 days inactive)
   * 2. Explainable discount anomalies (sample >= 5, deviation > mean + 2*stddev or > 15%)
   * 3. Delivery slippage (backordered orders)
   * 4. Overdue billing (past-due invoices)
   * Deduplicates active alerts by fingerprint.
   */
  static async scanDealHealth(
    tx: Db,
    tenantId: string,
    options?: { now?: Date; stalledDaysThreshold?: number },
  ) {
    const now = options?.now ?? new Date();
    const stalledDays = options?.stalledDaysThreshold ?? 14;
    const stalledCutoff = new Date(now.getTime() - stalledDays * 24 * 60 * 60 * 1000);

    const detectedAlerts: Array<{
      alertType: "stalled_quote" | "discount_anomaly" | "delivery_slippage" | "overdue_invoice";
      entityType: "quote" | "order" | "invoice" | "shipment";
      entityId: string;
      severity: "info" | "warning" | "critical";
      title: string;
      reason: string;
      confidence: string;
      context: Record<string, unknown>;
      fingerprint: string;
    }> = [];

    // 1. Stalled quotes
    const activeQuotes = await tx
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.tenantId, tenantId),
          inArray(quotes.status, [
            "submittedForApproval",
            "awaitingApproval",
            "sharedWithCustomer",
            "underNegotiation",
          ]),
        ),
      );

    for (const q of activeQuotes) {
      if (q.updatedAt < stalledCutoff) {
        const daysInactive = Math.floor(
          (now.getTime() - q.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        detectedAlerts.push({
          alertType: "stalled_quote",
          entityType: "quote",
          entityId: q.id,
          severity: daysInactive > 30 ? "critical" : "warning",
          title: `Stalled Quote ${q.number}`,
          reason: `No activity on quote ${q.number} in ${daysInactive} days while in stage "${q.status}".`,
          confidence: "100.00",
          context: {
            quoteId: q.id,
            quoteNumber: q.number,
            status: q.status,
            daysInactive,
            grandTotal: q.grandTotal,
            ownerUserId: q.ownerUserId,
            customerId: q.customerId,
          },
          fingerprint: `stalled_quote:quote:${q.id}`,
        });
      }
    }

    // 2. Discount anomaly
    // Baseline quotes: approved or accepted quotes
    const baselineQuotes = await tx
      .select({
        subtotal: quotes.subtotal,
        discountTotal: quotes.discountTotal,
      })
      .from(quotes)
      .where(
        and(
          eq(quotes.tenantId, tenantId),
          inArray(quotes.status, [
            "approvedInternal",
            "sharedWithCustomer",
            "customerAccepted",
            "readyForOrder",
            "converted",
          ]),
        ),
      );

    const discountPcts: number[] = [];
    for (const b of baselineQuotes) {
      const sub = Number(b.subtotal);
      const disc = Number(b.discountTotal);
      if (sub > 0) {
        discountPcts.push((disc / sub) * 100);
      }
    }

    const stats = calculateDiscountStats(discountPcts);

    // Evaluate active proposals / drafts
    const candidateQuotes = await tx
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.tenantId, tenantId),
          inArray(quotes.status, [
            "draft",
            "submittedForApproval",
            "awaitingApproval",
            "sharedWithCustomer",
            "underNegotiation",
          ]),
        ),
      );

    for (const q of candidateQuotes) {
      const sub = Number(q.subtotal);
      const disc = Number(q.discountTotal);
      if (sub > 0) {
        const pct = (disc / sub) * 100;
        const anomaly = evaluateDiscountAnomaly(pct, stats, 5);
        if (anomaly.isAnomaly) {
          detectedAlerts.push({
            alertType: "discount_anomaly",
            entityType: "quote",
            entityId: q.id,
            severity: pct > 25 ? "critical" : "warning",
            title: `Discount Anomaly on Quote ${q.number}`,
            reason: anomaly.reason!,
            confidence: anomaly.confidence.toFixed(2),
            context: {
              quoteId: q.id,
              quoteNumber: q.number,
              discountPct: pct.toFixed(2),
              subtotal: q.subtotal,
              discountTotal: q.discountTotal,
              benchmarkMean: stats.mean.toFixed(2),
              benchmarkCount: stats.sampleCount,
              ownerUserId: q.ownerUserId,
            },
            fingerprint: `discount_anomaly:quote:${q.id}`,
          });
        }
      }
    }

    // 3. Delivery slippage (backordered orders)
    const backorderedOrders = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.status, "backordered")));

    for (const ord of backorderedOrders) {
      detectedAlerts.push({
        alertType: "delivery_slippage",
        entityType: "order",
        entityId: ord.id,
        severity: "warning",
        title: `Backordered Items on Order ${ord.number}`,
        reason: `Order ${ord.number} has backordered lines requiring split fulfillment or replenishment.`,
        confidence: "100.00",
        context: {
          orderId: ord.id,
          orderNumber: ord.number,
          status: ord.status,
          customerId: ord.customerId,
          grandTotal: ord.grandTotal,
        },
        fingerprint: `delivery_slippage:order:${ord.id}`,
      });
    }

    // 4. Overdue invoices
    const overdueInvoices = await tx
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          inArray(invoices.status, ["issued", "partial"]),
          sql`${invoices.dueAt} < ${now}`,
        ),
      );

    for (const inv of overdueInvoices) {
      const daysOverdue = inv.dueAt
        ? Math.floor((now.getTime() - inv.dueAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      detectedAlerts.push({
        alertType: "overdue_invoice",
        entityType: "invoice",
        entityId: inv.id,
        severity: daysOverdue > 14 ? "critical" : "warning",
        title: `Overdue Invoice ${inv.number}`,
        reason: `Invoice ${inv.number} is overdue by ${daysOverdue} days with an outstanding balance of ${inv.balance} ${inv.currency}.`,
        confidence: "100.00",
        context: {
          invoiceId: inv.id,
          invoiceNumber: inv.number,
          dueAt: inv.dueAt?.toISOString(),
          daysOverdue,
          balance: inv.balance,
          currency: inv.currency,
          customerId: inv.customerId,
        },
        fingerprint: `overdue_invoice:invoice:${inv.id}`,
      });
    }

    // Query existing active alerts to deduplicate
    const existingActiveAlerts = await tx
      .select()
      .from(alerts)
      .where(and(eq(alerts.tenantId, tenantId), eq(alerts.status, "active")));

    const existingMap = new Map(existingActiveAlerts.map((a) => [a.fingerprint, a]));
    const detectedFingerprints = new Set(detectedAlerts.map((d) => d.fingerprint));

    // Upsert detected alerts
    for (const d of detectedAlerts) {
      const existing = existingMap.get(d.fingerprint);
      if (existing) {
        // Update context & sourceTime if changed
        await tx
          .update(alerts)
          .set({
            sourceTime: now,
            context: d.context,
            reason: d.reason,
            confidence: d.confidence,
            severity: d.severity,
            updatedAt: now,
          })
          .where(eq(alerts.id, existing.id));
      } else {
        // Insert new active alert
        await tx.insert(alerts).values({
          tenantId,
          alertType: d.alertType,
          entityType: d.entityType,
          entityId: d.entityId,
          status: "active",
          severity: d.severity,
          title: d.title,
          reason: d.reason,
          confidence: d.confidence,
          context: d.context,
          sourceTime: now,
          fingerprint: d.fingerprint,
        });
      }
    }

    // Auto-resolve active alerts that no longer exist
    for (const existing of existingActiveAlerts) {
      if (!detectedFingerprints.has(existing.fingerprint)) {
        await tx
          .update(alerts)
          .set({
            status: "resolved",
            resolvedAt: now,
            updatedAt: now,
          })
          .where(eq(alerts.id, existing.id));
      }
    }

    return { detectedCount: detectedAlerts.length };
  }

  /**
   * Retrieves active deal-health alerts and summary counts for a tenant.
   */
  static async getDealHealth(
    tx: Db,
    tenantId: string,
    userContext?: { userId?: string; role?: string },
  ) {
    const activeList = await tx
      .select()
      .from(alerts)
      .where(and(eq(alerts.tenantId, tenantId), eq(alerts.status, "active")))
      .orderBy(desc(alerts.createdAt));

    let filtered = activeList;
    if (userContext?.role === "rep" && userContext.userId) {
      // Prioritize/filter rep's deals
      filtered = activeList.filter((a) => {
        const ctx = a.context as Record<string, unknown> | null;
        return !ctx?.ownerUserId || ctx.ownerUserId === userContext.userId;
      });
    }

    const summary = {
      stalledCount: activeList.filter((a) => a.alertType === "stalled_quote").length,
      anomalyCount: activeList.filter((a) => a.alertType === "discount_anomaly").length,
      slippageCount: activeList.filter((a) => a.alertType === "delivery_slippage").length,
      overdueCount: activeList.filter((a) => a.alertType === "overdue_invoice").length,
      totalActive: activeList.length,
    };

    return {
      summary,
      alerts: filtered.map((a) => ({
        id: a.id,
        alertType: a.alertType,
        entityType: a.entityType,
        entityId: a.entityId,
        status: a.status,
        severity: a.severity,
        title: a.title,
        reason: a.reason,
        confidence: a.confidence,
        context: a.context,
        sourceTime: a.sourceTime,
        nudgedAt: a.nudgedAt,
        nudgeCount: a.nudgeCount,
        createdAt: a.createdAt,
      })),
    };
  }

  /**
   * Idempotently sends a nudge on an active alert:
   * Creates notification, updates alert nudge tracking, records audit and outbox events.
   */
  static async nudgeAlert(
    tx: Db,
    input: {
      tenantId: string;
      alertId: string;
      message?: string;
      actorId?: string;
      requestId?: string;
    },
  ) {
    const [alertRecord] = await tx
      .select()
      .from(alerts)
      .where(and(eq(alerts.tenantId, input.tenantId), eq(alerts.id, input.alertId)))
      .limit(1);

    if (!alertRecord) {
      throw new ApiError(404, "NOT_FOUND", "Alert not found");
    }
    if (alertRecord.status !== "active") {
      throw new ApiError(400, "BAD_REQUEST", "Cannot nudge inactive alert");
    }

    const now = new Date();
    const newNudgeCount = alertRecord.nudgeCount + 1;

    // Update alert
    await tx
      .update(alerts)
      .set({
        nudgedAt: now,
        nudgeCount: newNudgeCount,
        updatedAt: now,
      })
      .where(eq(alerts.id, alertRecord.id));

    const ctx = alertRecord.context as Record<string, unknown> | null;
    const recipientUserId = (ctx?.ownerUserId as string) || null;

    // Create notification
    const [notif] = await tx
      .insert(notifications)
      .values({
        tenantId: input.tenantId,
        recipientUserId,
        recipientRole: recipientUserId ? "rep" : "manager",
        alertId: alertRecord.id,
        title: `Nudge on Alert: ${alertRecord.title}`,
        message: input.message ?? `Alert requires attention: ${alertRecord.reason}`,
        deliveryChannel: "in_app",
        deliveryStatus: "delivered",
        deliveredAt: now,
      })
      .returning();

    // Transactional audit event
    await writeAuditEvent(tx, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "deal_health.nudge",
      entityType: "alert",
      entityId: alertRecord.id,
      detail: {
        nudgeCount: newNudgeCount,
        message: input.message,
        recipientUserId,
      },
      requestId: input.requestId,
    });

    // Transactional outbox event
    await tx.insert(outboxEvents).values({
      tenantId: input.tenantId,
      aggregateType: "alert",
      aggregateId: alertRecord.id,
      eventType: "alert.nudged",
      payload: {
        alertId: alertRecord.id,
        entityType: alertRecord.entityType,
        entityId: alertRecord.entityId,
        nudgeCount: newNudgeCount,
        message: input.message,
      },
    });

    return {
      alert: {
        ...alertRecord,
        nudgedAt: now,
        nudgeCount: newNudgeCount,
      },
      notification: notif,
    };
  }
}
