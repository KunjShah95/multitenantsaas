import crypto from "node:crypto";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import type { Db } from "../../db/connection.js";
import { reportExports, quotes, orders, invoices, outboxEvents } from "../../db/schema/index.js";
import { writeAuditEvent } from "../../shared/audit.js";
import { ApiError } from "../../shared/errors.js";

/**
 * Pure RFC 4180 CSV formatter.
 * Escapes fields containing commas, quotes, or newlines.
 */
export function formatCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  const escapeField = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeField).join(",");
  const dataLines = rows.map((row) => row.map(escapeField).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}

export class ExportsService {
  /**
   * Generates a report export (CSV or JSON) bounded to 1,000 records,
   * stores content with a 24-hour signed token, and emits an outbox event.
   */
  static async createReportExport(
    tx: Db,
    input: {
      tenantId: string;
      requestedBy?: string;
      reportType: "quotes" | "orders" | "sales";
      format: "csv" | "json";
      parameters?: Record<string, unknown>;
      actorId?: string;
      requestId?: string;
    },
  ) {
    const { tenantId, requestedBy, reportType, format, parameters = {} } = input;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    const downloadToken = crypto.randomBytes(24).toString("hex");

    let fileContent = "";
    let rowCount = 0;

    if (reportType === "quotes") {
      const qConds = [eq(quotes.tenantId, tenantId)];
      if (parameters.fromDate)
        qConds.push(gte(quotes.createdAt, new Date(String(parameters.fromDate))));
      if (parameters.toDate)
        qConds.push(lte(quotes.createdAt, new Date(String(parameters.toDate))));
      if (parameters.status) qConds.push(eq(quotes.status, String(parameters.status)));

      const records = await tx
        .select({
          number: quotes.number,
          customerId: quotes.customerId,
          status: quotes.status,
          currency: quotes.currency,
          subtotal: quotes.subtotal,
          discountTotal: quotes.discountTotal,
          netTotal: quotes.netTotal,
          grandTotal: quotes.grandTotal,
          marginPct: quotes.marginPct,
          createdAt: quotes.createdAt,
        })
        .from(quotes)
        .where(and(...qConds))
        .orderBy(desc(quotes.createdAt))
        .limit(1000);

      rowCount = records.length;
      if (format === "csv") {
        const headers = [
          "Quote Number",
          "Customer ID",
          "Status",
          "Currency",
          "Subtotal",
          "Discount",
          "Net Total",
          "Grand Total",
          "Margin %",
          "Created At",
        ];
        const rows = records.map((r) => [
          r.number,
          r.customerId,
          r.status,
          r.currency,
          r.subtotal,
          r.discountTotal,
          r.netTotal,
          r.grandTotal,
          r.marginPct ?? "",
          r.createdAt.toISOString(),
        ]);
        fileContent = formatCsv(headers, rows);
      } else {
        fileContent = JSON.stringify(records, null, 2);
      }
    } else if (reportType === "orders") {
      const ordConds = [eq(orders.tenantId, tenantId)];
      if (parameters.fromDate)
        ordConds.push(gte(orders.createdAt, new Date(String(parameters.fromDate))));
      if (parameters.toDate)
        ordConds.push(lte(orders.createdAt, new Date(String(parameters.toDate))));
      if (parameters.status) ordConds.push(eq(orders.status, String(parameters.status)));

      const records = await tx
        .select({
          number: orders.number,
          quoteId: orders.quoteId,
          customerId: orders.customerId,
          status: orders.status,
          currency: orders.currency,
          subtotal: orders.subtotal,
          discountTotal: orders.discountTotal,
          netTotal: orders.netTotal,
          grandTotal: orders.grandTotal,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(and(...ordConds))
        .orderBy(desc(orders.createdAt))
        .limit(1000);

      rowCount = records.length;
      if (format === "csv") {
        const headers = [
          "Order Number",
          "Quote ID",
          "Customer ID",
          "Status",
          "Currency",
          "Subtotal",
          "Discount",
          "Net Total",
          "Grand Total",
          "Created At",
        ];
        const rows = records.map((r) => [
          r.number,
          r.quoteId,
          r.customerId,
          r.status,
          r.currency,
          r.subtotal,
          r.discountTotal,
          r.netTotal,
          r.grandTotal,
          r.createdAt.toISOString(),
        ]);
        fileContent = formatCsv(headers, rows);
      } else {
        fileContent = JSON.stringify(records, null, 2);
      }
    } else {
      // Sales / Invoices
      const invConds = [eq(invoices.tenantId, tenantId)];
      if (parameters.fromDate)
        invConds.push(gte(invoices.createdAt, new Date(String(parameters.fromDate))));
      if (parameters.toDate)
        invConds.push(lte(invoices.createdAt, new Date(String(parameters.toDate))));
      if (parameters.status) invConds.push(eq(invoices.status, String(parameters.status)));

      const records = await tx
        .select({
          number: invoices.number,
          orderId: invoices.orderId,
          customerId: invoices.customerId,
          invoiceType: invoices.invoiceType,
          status: invoices.status,
          currency: invoices.currency,
          grandTotal: invoices.grandTotal,
          balance: invoices.balance,
          dueAt: invoices.dueAt,
          createdAt: invoices.createdAt,
        })
        .from(invoices)
        .where(and(...invConds))
        .orderBy(desc(invoices.createdAt))
        .limit(1000);

      rowCount = records.length;
      if (format === "csv") {
        const headers = [
          "Invoice Number",
          "Order ID",
          "Customer ID",
          "Type",
          "Status",
          "Currency",
          "Grand Total",
          "Balance",
          "Due At",
          "Created At",
        ];
        const rows = records.map((r) => [
          r.number,
          r.orderId ?? "",
          r.customerId,
          r.invoiceType,
          r.status,
          r.currency,
          r.grandTotal,
          r.balance,
          r.dueAt?.toISOString() ?? "",
          r.createdAt.toISOString(),
        ]);
        fileContent = formatCsv(headers, rows);
      } else {
        fileContent = JSON.stringify(records, null, 2);
      }
    }

    const fileSizeBytes = Buffer.byteLength(fileContent, "utf8");

    const [created] = await tx
      .insert(reportExports)
      .values({
        tenantId,
        requestedBy: requestedBy ?? null,
        reportType,
        format,
        parameters,
        status: "completed",
        rowCount,
        fileSizeBytes,
        downloadToken,
        fileContent,
        expiresAt,
      })
      .returning();

    if (!created) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to create report export");
    }

    // Transactional audit event
    await writeAuditEvent(tx, {
      tenantId,
      actorId: input.actorId,
      action: "report.export",
      entityType: "report_export",
      entityId: created.id,
      detail: { reportType, format, rowCount, fileSizeBytes },
      requestId: input.requestId,
    });

    // Transactional outbox event
    await tx.insert(outboxEvents).values({
      tenantId,
      aggregateType: "reportExport",
      aggregateId: created.id,
      eventType: "reportExport.completed",
      payload: {
        exportId: created.id,
        reportType,
        format,
        rowCount,
      },
    });

    return {
      export: {
        id: created.id,
        reportType: created.reportType,
        format: created.format,
        status: created.status,
        rowCount: created.rowCount,
        fileSizeBytes: created.fileSizeBytes,
        expiresAt: created.expiresAt,
        downloadUrl: `/api/v1/report-exports/${created.id}/download?token=${downloadToken}`,
      },
    };
  }

  /**
   * Retrieves status and download info for a report export.
   */
  static async getExportStatus(tx: Db, tenantId: string, exportId: string) {
    const [exp] = await tx
      .select()
      .from(reportExports)
      .where(and(eq(reportExports.tenantId, tenantId), eq(reportExports.id, exportId)))
      .limit(1);

    if (!exp) {
      throw new ApiError(404, "NOT_FOUND", "Report export not found");
    }

    return {
      id: exp.id,
      reportType: exp.reportType,
      format: exp.format,
      status: exp.status,
      rowCount: exp.rowCount,
      fileSizeBytes: exp.fileSizeBytes,
      expiresAt: exp.expiresAt,
      downloadUrl: exp.downloadToken
        ? `/api/v1/report-exports/${exp.id}/download?token=${exp.downloadToken}`
        : null,
      createdAt: exp.createdAt,
    };
  }

  /**
   * Validates download token & expiration, and returns the file payload.
   */
  static async getExportDownload(tx: Db, tenantId: string, exportId: string, token: string) {
    const [exp] = await tx
      .select()
      .from(reportExports)
      .where(and(eq(reportExports.tenantId, tenantId), eq(reportExports.id, exportId)))
      .limit(1);

    if (!exp) {
      throw new ApiError(404, "NOT_FOUND", "Report export not found");
    }
    if (exp.status !== "completed" || !exp.fileContent) {
      throw new ApiError(400, "BAD_REQUEST", "Report export not ready for download");
    }
    if (exp.downloadToken !== token) {
      throw new ApiError(403, "FORBIDDEN", "Invalid or unauthorized download token");
    }
    if (exp.expiresAt && exp.expiresAt.getTime() < Date.now()) {
      throw new ApiError(410, "BAD_REQUEST", "Report download link has expired");
    }

    const ext = exp.format === "csv" ? "csv" : "json";
    const filename = `${exp.reportType}-report-${exp.id.slice(0, 8)}.${ext}`;
    const contentType = exp.format === "csv" ? "text/csv" : "application/json";

    return {
      fileContent: exp.fileContent,
      filename,
      contentType,
    };
  }
}
