import { sql, eq, and, desc, gte, lte } from "drizzle-orm";
import type { Db } from "../../db/connection.js";
import { quotes, orders, invoices, subscriptions } from "../../db/schema/index.js";
import { decodeCursor, buildPage } from "../../shared/pagination.js";

export interface QuoteReportFilters {
  fromDate?: Date;
  toDate?: Date;
  teamId?: string;
  ownerUserId?: string;
  customerId?: string;
  status?: string;
  currency?: string;
}

export interface OrderReportFilters {
  fromDate?: Date;
  toDate?: Date;
  customerId?: string;
  status?: string;
  currency?: string;
}

export interface SalesReportFilters {
  fromDate?: Date;
  toDate?: Date;
  currency?: string;
}

export class ReportsService {
  /**
   * Retrieves quotes report with bounded aggregates and cursor pagination.
   */
  static async getQuoteReport(
    tx: Db,
    tenantId: string,
    filters: QuoteReportFilters,
    pagination: { limit: number; cursor?: string },
  ) {
    const conditions = [eq(quotes.tenantId, tenantId)];

    if (filters.fromDate) {
      conditions.push(gte(quotes.createdAt, filters.fromDate));
    }
    if (filters.toDate) {
      conditions.push(lte(quotes.createdAt, filters.toDate));
    }
    if (filters.teamId) {
      conditions.push(eq(quotes.teamId, filters.teamId));
    }
    if (filters.ownerUserId) {
      conditions.push(eq(quotes.ownerUserId, filters.ownerUserId));
    }
    if (filters.customerId) {
      conditions.push(eq(quotes.customerId, filters.customerId));
    }
    if (filters.status) {
      conditions.push(eq(quotes.status, filters.status));
    }
    if (filters.currency) {
      conditions.push(eq(quotes.currency, filters.currency));
    }

    const whereClause = and(...conditions);

    // 1. Aggregates via SQL
    const [aggResult] = await tx
      .select({
        totalCount: sql<number>`count(*)::int`,
        totalSubtotal: sql<string>`coalesce(sum(${quotes.subtotal}), 0)::text`,
        totalDiscount: sql<string>`coalesce(sum(${quotes.discountTotal}), 0)::text`,
        totalNet: sql<string>`coalesce(sum(${quotes.netTotal}), 0)::text`,
        totalTax: sql<string>`coalesce(sum(${quotes.taxTotal}), 0)::text`,
        totalGrand: sql<string>`coalesce(sum(${quotes.grandTotal}), 0)::text`,
        avgMarginPct: sql<string>`coalesce(round(avg(${quotes.marginPct}), 2), 0)::text`,
      })
      .from(quotes)
      .where(whereClause);

    // Status breakdown
    const statusCounts = await tx
      .select({
        status: quotes.status,
        count: sql<number>`count(*)::int`,
        totalValue: sql<string>`coalesce(sum(${quotes.grandTotal}), 0)::text`,
      })
      .from(quotes)
      .where(whereClause)
      .groupBy(quotes.status);

    // 2. Cursor pagination query
    const listConditions = [...conditions];
    if (pagination.cursor) {
      const decoded = decodeCursor(pagination.cursor);
      if (decoded) {
        listConditions.push(
          sql`(${quotes.createdAt}, ${quotes.id}) < (${new Date(decoded.createdAt)}, ${decoded.id})`,
        );
      }
    }

    const limit = Math.min(100, Math.max(1, pagination.limit));
    const items = await tx
      .select({
        id: quotes.id,
        number: quotes.number,
        customerId: quotes.customerId,
        ownerUserId: quotes.ownerUserId,
        teamId: quotes.teamId,
        currency: quotes.currency,
        status: quotes.status,
        subtotal: quotes.subtotal,
        discountTotal: quotes.discountTotal,
        netTotal: quotes.netTotal,
        taxTotal: quotes.taxTotal,
        grandTotal: quotes.grandTotal,
        marginPct: quotes.marginPct,
        createdAt: quotes.createdAt,
      })
      .from(quotes)
      .where(and(...listConditions))
      .orderBy(desc(quotes.createdAt), desc(quotes.id))
      .limit(limit + 1);

    const page = buildPage(items, limit);

    return {
      aggregates: {
        totalCount: aggResult?.totalCount ?? 0,
        totalSubtotal: aggResult?.totalSubtotal ?? "0",
        totalDiscount: aggResult?.totalDiscount ?? "0",
        totalNet: aggResult?.totalNet ?? "0",
        totalTax: aggResult?.totalTax ?? "0",
        totalGrand: aggResult?.totalGrand ?? "0",
        avgMarginPct: aggResult?.avgMarginPct ?? "0",
        statusBreakdown: Object.fromEntries(
          statusCounts.map((s) => [s.status, { count: s.count, totalValue: s.totalValue }]),
        ),
      },
      ...page,
    };
  }

  /**
   * Retrieves orders report with bounded aggregates and cursor pagination.
   */
  static async getOrderReport(
    tx: Db,
    tenantId: string,
    filters: OrderReportFilters,
    pagination: { limit: number; cursor?: string },
  ) {
    const conditions = [eq(orders.tenantId, tenantId)];

    if (filters.fromDate) {
      conditions.push(gte(orders.createdAt, filters.fromDate));
    }
    if (filters.toDate) {
      conditions.push(lte(orders.createdAt, filters.toDate));
    }
    if (filters.customerId) {
      conditions.push(eq(orders.customerId, filters.customerId));
    }
    if (filters.status) {
      conditions.push(eq(orders.status, filters.status));
    }
    if (filters.currency) {
      conditions.push(eq(orders.currency, filters.currency));
    }

    const whereClause = and(...conditions);

    // Aggregates
    const [aggResult] = await tx
      .select({
        totalCount: sql<number>`count(*)::int`,
        totalSubtotal: sql<string>`coalesce(sum(${orders.subtotal}), 0)::text`,
        totalNet: sql<string>`coalesce(sum(${orders.netTotal}), 0)::text`,
        totalGrand: sql<string>`coalesce(sum(${orders.grandTotal}), 0)::text`,
        backorderedCount: sql<number>`count(*) filter (where ${orders.status} = 'backordered')::int`,
      })
      .from(orders)
      .where(whereClause);

    // Status breakdown
    const statusCounts = await tx
      .select({
        status: orders.status,
        count: sql<number>`count(*)::int`,
        totalValue: sql<string>`coalesce(sum(${orders.grandTotal}), 0)::text`,
      })
      .from(orders)
      .where(whereClause)
      .groupBy(orders.status);

    // Cursor pagination
    const listConditions = [...conditions];
    if (pagination.cursor) {
      const decoded = decodeCursor(pagination.cursor);
      if (decoded) {
        listConditions.push(
          sql`(${orders.createdAt}, ${orders.id}) < (${new Date(decoded.createdAt)}, ${decoded.id})`,
        );
      }
    }

    const limit = Math.min(100, Math.max(1, pagination.limit));
    const items = await tx
      .select({
        id: orders.id,
        number: orders.number,
        quoteId: orders.quoteId,
        customerId: orders.customerId,
        currency: orders.currency,
        status: orders.status,
        subtotal: orders.subtotal,
        discountTotal: orders.discountTotal,
        netTotal: orders.netTotal,
        taxTotal: orders.taxTotal,
        grandTotal: orders.grandTotal,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(...listConditions))
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(limit + 1);

    const page = buildPage(items, limit);

    return {
      aggregates: {
        totalCount: aggResult?.totalCount ?? 0,
        totalSubtotal: aggResult?.totalSubtotal ?? "0",
        totalNet: aggResult?.totalNet ?? "0",
        totalGrand: aggResult?.totalGrand ?? "0",
        backorderedCount: aggResult?.backorderedCount ?? 0,
        statusBreakdown: Object.fromEntries(
          statusCounts.map((s) => [s.status, { count: s.count, totalValue: s.totalValue }]),
        ),
      },
      ...page,
    };
  }

  /**
   * Retrieves overall sales metrics: billing totals (paid, overdue, issued) and subscription MRR/ARR.
   */
  static async getSalesReport(tx: Db, tenantId: string, filters: SalesReportFilters) {
    const invoiceConditions = [eq(invoices.tenantId, tenantId)];
    if (filters.fromDate) invoiceConditions.push(gte(invoices.createdAt, filters.fromDate));
    if (filters.toDate) invoiceConditions.push(lte(invoices.createdAt, filters.toDate));
    if (filters.currency) invoiceConditions.push(eq(invoices.currency, filters.currency));

    const [invoiceAgg] = await tx
      .select({
        totalInvoicedCount: sql<number>`count(*)::int`,
        totalInvoicedAmount: sql<string>`coalesce(sum(${invoices.grandTotal}), 0)::text`,
        totalPaidAmount: sql<string>`coalesce(sum(${invoices.grandTotal} - ${invoices.balance}) filter (where ${invoices.status} IN ('paid', 'partial')), 0)::text`,
        totalOutstandingAmount: sql<string>`coalesce(sum(${invoices.balance}) filter (where ${invoices.status} IN ('issued', 'partial')), 0)::text`,
        totalOverdueAmount: sql<string>`coalesce(sum(${invoices.balance}) filter (where ${invoices.dueAt} < now() and ${invoices.status} IN ('issued', 'partial')), 0)::text`,
      })
      .from(invoices)
      .where(and(...invoiceConditions));

    // Subscription recurring run rate
    const subConditions = [
      eq(subscriptions.tenantId, tenantId),
      eq(subscriptions.status, "active"),
    ];
    if (filters.currency) subConditions.push(eq(subscriptions.snapshotCurrency, filters.currency));

    const activeSubs = await tx
      .select({
        billingInterval: subscriptions.billingInterval,
        periodUnitTotal: subscriptions.periodUnitTotal,
        quantity: subscriptions.quantity,
      })
      .from(subscriptions)
      .where(and(...subConditions));

    let monthlyRunRate = 0;
    for (const sub of activeSubs) {
      const lineTotal = Number(sub.periodUnitTotal) * Number(sub.quantity);
      if (sub.billingInterval === "monthly") {
        monthlyRunRate += lineTotal;
      } else if (sub.billingInterval === "quarterly") {
        monthlyRunRate += lineTotal / 3;
      } else if (sub.billingInterval === "yearly") {
        monthlyRunRate += lineTotal / 12;
      }
    }

    const annualRunRate = monthlyRunRate * 12;

    return {
      invoices: {
        totalCount: invoiceAgg?.totalInvoicedCount ?? 0,
        totalInvoicedAmount: invoiceAgg?.totalInvoicedAmount ?? "0",
        totalPaidAmount: invoiceAgg?.totalPaidAmount ?? "0",
        totalOutstandingAmount: invoiceAgg?.totalOutstandingAmount ?? "0",
        totalOverdueAmount: invoiceAgg?.totalOverdueAmount ?? "0",
      },
      subscriptions: {
        activeCount: activeSubs.length,
        mrr: monthlyRunRate.toFixed(2),
        arr: annualRunRate.toFixed(2),
      },
    };
  }
}
