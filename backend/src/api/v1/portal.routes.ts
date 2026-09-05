import { Router } from "express";
import { z } from "zod";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { authenticatePortal } from "../../middleware/authenticate.js";
import { ApiError } from "../../shared/errors.js";
import { withTenantTransaction } from "../../db/transaction.js";
import { writeAuditEvent } from "../../shared/audit.js";
import { findIdempotency, storeIdempotency } from "../../shared/idempotency.js";
import { paginationQuerySchema, encodeCursor, decodeCursor } from "../../shared/pagination.js";
import * as schema from "../../db/schema/index.js";
import rateLimit from "express-rate-limit";
import { OrdersService } from "../../domain/orders/orders.service.js";

export const portalQuotesRouter = Router();

const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests", requestId: (res as unknown as { req: { requestId: string } }).req.requestId } });
  },
});

function portalSafeQuote(quote: typeof schema.quotes.$inferSelect, customer: any, lines: any[], availableActions: string[]) {
  return {
    id: quote.id,
    number: quote.number,
    status: quote.status,
    revision: quote.revision,
    version: quote.currentVersion,
    currency: quote.currency,
    customer: customer ? { id: customer.id, name: customer.name, tierCode: customer.tierCode } : null,
    totals: {
      subtotal: quote.subtotal,
      discount: quote.discountTotal,
      net: quote.netTotal,
      tax: quote.taxTotal,
      grandTotal: quote.grandTotal,
      // margin deliberately omitted
    },
    lines: lines.map((l: any) => ({
      id: l.id,
      productId: l.productId,
      variantId: l.variantId,
      quantity: l.quantity,
      discountPct: l.discountPct,
      billingType: l.billingType,
      snapshot: {
        name: l.snapshotName,
        sku: l.snapshotSku,
        variantSku: l.snapshotVariantSku,
        categoryCode: l.snapshotCategoryCode,
        unit: l.snapshotUnit,
        unitPrice: l.snapshotUnitPrice,
        // unitCost deliberately omitted
        taxRatePct: l.snapshotTaxRatePct,
        currency: l.snapshotCurrency,
      },
      totals: {
        subtotal: l.lineSubtotal,
        discount: l.lineDiscount,
        net: l.lineNet,
        tax: l.lineTax,
        total: l.lineTotal,
        // margin omitted
      },
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
    expiresAt: quote.expiresAt,
    availableActions,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}

function getPortalAvailableActions(status: string): string[] {
  if (status === "sharedWithCustomer" || status === "underNegotiation") return ["comment", "requestNegotiation", "accept"];
  if (status === "customerAccepted" || status === "readyForOrder") return [];
  return [];
}

async function buildPortalQuoteModel(tx: any, tenantId: string, quote: typeof schema.quotes.$inferSelect) {
  const lines = await tx
    .select()
    .from(schema.quoteLines)
    .where(and(eq(schema.quoteLines.quoteId, quote.id), eq(schema.quoteLines.tenantId, tenantId)))
    .orderBy(asc(schema.quoteLines.createdAt));
  const custRows = await tx
    .select()
    .from(schema.customers)
    .where(and(eq(schema.customers.id, quote.customerId), eq(schema.customers.tenantId, tenantId)))
    .limit(1);
  const customer = custRows[0] ?? null;
  const availableActions = getPortalAvailableActions(quote.status);
  return portalSafeQuote(quote, customer, lines, availableActions);
}

function isShareActive(share: typeof schema.quoteShares.$inferSelect): boolean {
  if (share.revokedAt) return false;
  if (share.expiresAt && new Date(share.expiresAt) <= new Date()) return false;
  return true;
}

// All portal routes require portal session
portalQuotesRouter.use(authenticatePortal);
portalQuotesRouter.use(portalLimiter);

// GET /portal/quotes  — list explicitly shared quotes only
portalQuotesRouter.get("/quotes", async (req, res, next) => {
  try {
    const { limit, cursor } = (() => {
      const parsed = paginationQuerySchema.safeParse(req.query);
      if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid pagination", parsed.error.flatten());
      return parsed.data;
    })();
    const ctx = req.portalAuth!;
    const { tenantId, contactId } = ctx;

    const result = await withTenantTransaction({ tenantId }, async (tx) => {
      // fetch active shares for this contact
      const shares = await tx
        .select()
        .from(schema.quoteShares)
        .where(and(eq(schema.quoteShares.tenantId, tenantId), eq(schema.quoteShares.contactId, contactId)));

      const activeShares = shares.filter(isShareActive);
      if (activeShares.length === 0) {
        return { data: [], page: { limit, nextCursor: null } };
      }

      // also verify contact.customerId matches share.customerId (integrity)
      // and contact exists
      const quoteIds = [...new Set(activeShares.map((s: any) => s.quoteId))];

      // fetch quotes with those ids, ordered by updatedAt desc
      // Use inArray
      const quotes = await tx
        .select()
        .from(schema.quotes)
        .where(and(eq(schema.quotes.tenantId, tenantId), inArray(schema.quotes.id, quoteIds)))
        .orderBy(desc(schema.quotes.updatedAt), desc(schema.quotes.id));

      // pagination by cursor (opaque based on updatedAt + id)
      let filtered = quotes;
      if (cursor) {
        const decoded = decodeCursor(cursor);
        if (!decoded) throw new ApiError(400, "BAD_REQUEST", "Invalid cursor");
        const idx = filtered.findIndex((r: any) => r.id === decoded.id);
        if (idx >= 0) filtered = filtered.slice(idx + 1);
        else {
          const cursorTime = new Date(decoded.createdAt).getTime();
          filtered = filtered.filter((r: any) => new Date(r.updatedAt).getTime() < cursorTime);
        }
      }
      const pageItems = filtered.slice(0, limit + 1);
      const hasMore = pageItems.length > limit;
      const items = hasMore ? pageItems.slice(0, limit) : pageItems;
      const nextCursor = hasMore && items.length > 0 ? encodeCursor({ createdAt: items[items.length - 1]!.updatedAt.toISOString(), id: items[items.length - 1]!.id }) : null;

      const enriched = await Promise.all(items.map((q: any) => buildPortalQuoteModel(tx, tenantId, q)));
      return { data: enriched, page: { limit, nextCursor } };
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});

// GET /portal/quotes/:id — portal-safe detail
portalQuotesRouter.get("/quotes/:id", async (req, res, next) => {
  try {
    const quoteId = req.params.id as string;
    if (!/^[0-9a-f-]{36}$/i.test(quoteId)) throw new ApiError(400, "BAD_REQUEST", "Invalid quote id");
    const ctx = req.portalAuth!;
    const { tenantId, contactId } = ctx;

    const result = await withTenantTransaction({ tenantId }, async (tx) => {
      // verify share exists and active for this contact+quote
      const shareRows = await tx
        .select()
        .from(schema.quoteShares)
        .where(and(eq(schema.quoteShares.tenantId, tenantId), eq(schema.quoteShares.quoteId, quoteId), eq(schema.quoteShares.contactId, contactId)));
      const active = shareRows.filter(isShareActive);
      if (active.length === 0) throw new ApiError(404, "NOT_FOUND", "Quote not found or not shared");

      const qRows = await tx.select().from(schema.quotes).where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, tenantId))).limit(1);
      const quote = qRows[0];
      if (!quote) throw new ApiError(404, "NOT_FOUND", "Quote not found");
      // ensure share version corresponds to at least one version? but allow detail even if quote moved ahead? Actually for security, if share version not current, still allow viewing? Spec says list/detail requires active share/customer relationship. So active share suffices.
      return buildPortalQuoteModel(tx, tenantId, quote);
    });

    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

// POST /portal/quotes/:id/comments  — idempotent
const commentSchema = z.object({ lineId: z.string().uuid().nullable().optional(), body: z.string().min(1).max(2000) }).strict();

portalQuotesRouter.post("/quotes/:id/comments", async (req, res, next) => {
  try {
    const quoteId = req.params.id as string;
    if (!/^[0-9a-f-]{36}$/i.test(quoteId)) throw new ApiError(400, "BAD_REQUEST", "Invalid quote id");
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const ctx = req.portalAuth!;
    const { tenantId, contactId } = ctx;
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    const requestId = (req as unknown as { requestId: string }).requestId;

    const result = await withTenantTransaction({ tenantId, actorId: contactId, requestId }, async (tx) => {
      if (idempotencyKey) {
        const existing = await findIdempotency(tx as any, { tenantId, actorId: contactId, operation: `portal.comment:${quoteId}`, key: idempotencyKey });
        if (existing) return { data: existing.responseBody as any, status: Number(existing.responseStatus ?? 201), fromIdempotency: true };
      }

      // verify active share
      const shareRows = await tx.select().from(schema.quoteShares).where(and(eq(schema.quoteShares.tenantId, tenantId), eq(schema.quoteShares.quoteId, quoteId), eq(schema.quoteShares.contactId, contactId)));
      const active = shareRows.filter(isShareActive);
      if (active.length === 0) throw new ApiError(404, "NOT_FOUND", "Quote not found or not shared");

      const qRows = await tx.select().from(schema.quotes).where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, tenantId))).limit(1);
      const quote = qRows[0];
      if (!quote) throw new ApiError(404, "NOT_FOUND", "Quote not found");
      if (["cancelled", "expired", "converted", "rejected"].includes(quote.status)) throw new ApiError(422, "UNPROCESSABLE", `Cannot comment in status ${quote.status}`);

      // validate lineId if provided
      if (parsed.data.lineId) {
        const lineRows = await tx.select().from(schema.quoteLines).where(and(eq(schema.quoteLines.id, parsed.data.lineId), eq(schema.quoteLines.quoteId, quoteId), eq(schema.quoteLines.tenantId, tenantId))).limit(1);
        if (!lineRows[0]) throw new ApiError(400, "BAD_REQUEST", "lineId does not belong to this quote");
      }

      // fetch contact for customerId
      const contactRows = await tx.select().from(schema.customerContacts).where(and(eq(schema.customerContacts.id, contactId), eq(schema.customerContacts.tenantId, tenantId))).limit(1);
      const contact = contactRows[0];
      if (!contact) throw new ApiError(401, "UNAUTHORIZED", "Contact not found");

      const share = active[0] as typeof schema.quoteShares.$inferSelect;
      const versionNumber = share.versionNumber;

      const [inserted] = await tx
        .insert(schema.quoteComments)
        .values({
          tenantId,
          quoteId,
          lineId: parsed.data.lineId ?? null,
          versionNumber,
          authorContactId: contactId,
          authorUserId: null,
          body: parsed.data.body,
          visibility: "portal_visible",
        })
        .returning();
      if (!inserted) throw new ApiError(500, "INTERNAL_ERROR", "Failed to create comment");

      await writeAuditEvent(tx as any, {
        tenantId,
        actorId: contactId,
        action: "portal.comment.create",
        entityType: "quote_comment",
        entityId: inserted!.id,
        requestId,
        detail: { quoteId, body: parsed.data.body, lineId: parsed.data.lineId ?? null } as any,
      });

      await tx.insert(schema.outboxEvents).values({
        tenantId,
        aggregateType: "quote",
        aggregateId: quoteId,
        eventType: "quote.commentCreated",
        payload: { quoteId, commentId: inserted!.id, contactId, body: parsed.data.body } as any,
      });

      const response = { id: inserted!.id, quoteId, body: inserted!.body, lineId: inserted!.lineId, visibility: inserted!.visibility, createdAt: inserted!.createdAt };

      if (idempotencyKey) {
        await storeIdempotency(tx as any, { tenantId, actorId: contactId, operation: `portal.comment:${quoteId}`, key: idempotencyKey, responseStatus: "201", responseBody: response });
      }

      return { data: response, status: 201, fromIdempotency: false };
    });

    if ((result as any).fromIdempotency) res.status((result as any).status).json({ data: (result as any).data });
    else res.status((result as any).status).json({ data: (result as any).data });
  } catch (e) {
    next(e);
  }
});

// POST /portal/quotes/:id/negotiation-requests — idempotent
const negotiationSchema = z
  .object({
    changes: z.any(),
    message: z.string().max(2000).optional().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.changes == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "changes required", path: ["changes"] });
      return;
    }
    // changes must be non-empty object/array
    try {
      const jsonStr = JSON.stringify(data.changes);
      if (jsonStr.length < 2 || jsonStr === "{}" || jsonStr === "[]") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "changes cannot be empty", path: ["changes"] });
      }
      if (jsonStr.length > 20000) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "changes too large", path: ["changes"] });
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "changes must be JSON serializable", path: ["changes"] });
    }
  });

portalQuotesRouter.post("/quotes/:id/negotiation-requests", async (req, res, next) => {
  try {
    const quoteId = req.params.id as string;
    if (!/^[0-9a-f-]{36}$/i.test(quoteId)) throw new ApiError(400, "BAD_REQUEST", "Invalid quote id");
    const parsed = negotiationSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const ctx = req.portalAuth!;
    const { tenantId, contactId } = ctx;
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    const requestId = (req as unknown as { requestId: string }).requestId;

    const result = await withTenantTransaction({ tenantId, actorId: contactId, requestId }, async (tx) => {
      if (idempotencyKey) {
        const existing = await findIdempotency(tx as any, { tenantId, actorId: contactId, operation: `portal.negotiation:${quoteId}`, key: idempotencyKey });
        if (existing) return { data: existing.responseBody as any, status: Number(existing.responseStatus ?? 202), fromIdempotency: true };
      }

      const shareRows = await tx.select().from(schema.quoteShares).where(and(eq(schema.quoteShares.tenantId, tenantId), eq(schema.quoteShares.quoteId, quoteId), eq(schema.quoteShares.contactId, contactId)));
      const active = shareRows.filter(isShareActive);
      if (active.length === 0) throw new ApiError(404, "NOT_FOUND", "Quote not found or not shared");

      const qRows = await tx.select().from(schema.quotes).where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, tenantId))).limit(1);
      const quote = qRows[0];
      if (!quote) throw new ApiError(404, "NOT_FOUND", "Quote not found");
      if (!["sharedWithCustomer", "underNegotiation"].includes(quote.status)) throw new ApiError(422, "UNPROCESSABLE", `Cannot request negotiation in status ${quote.status}`);

      const contactRows = await tx.select().from(schema.customerContacts).where(and(eq(schema.customerContacts.id, contactId), eq(schema.customerContacts.tenantId, tenantId))).limit(1);
      const contact = contactRows[0];
      if (!contact) throw new ApiError(401, "UNAUTHORIZED", "Contact not found");

      const share = active[0] as typeof schema.quoteShares.$inferSelect;
      // verify share's version matches quote's currentVersion? If quote has moved to underNegotiation via prior negotiation, still share version should be base
      // For new negotiation, base should be share version
      const baseVersionNumber = share.versionNumber;
      const baseVersionId = share.versionId;

      // Defensive: ensure no mutation of quote/lines — we just store request, not modify
      // Fetch lines count for audit but not modify

      const [inserted] = await tx
        .insert(schema.negotiationRequests)
        .values({
          tenantId,
          quoteId,
          baseVersionId: baseVersionId ?? null,
          baseVersionNumber,
          contactId,
          customerId: contact.customerId,
          requestedChanges: parsed.data.changes as any,
          message: parsed.data.message ?? null,
          status: "pending",
        })
        .returning();
      if (!inserted) throw new ApiError(500, "INTERNAL_ERROR", "Failed to create negotiation");

      // transition quote to underNegotiation if not already
      let updatedQuote = quote;
      if (quote.status === "sharedWithCustomer") {
        const [uq] = await tx
          .update(schema.quotes)
          .set({ status: "underNegotiation" as any, updatedAt: new Date() })
          .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, tenantId)))
          .returning();
        if (uq) updatedQuote = uq;
      }

      await writeAuditEvent(tx as any, {
        tenantId,
        actorId: contactId,
        action: "portal.negotiation.create",
        entityType: "negotiation_request",
        entityId: inserted.id,
        requestId,
        detail: { quoteId, baseVersionNumber, message: parsed.data.message ?? null } as any,
      });

      await tx.insert(schema.outboxEvents).values({
        tenantId,
        aggregateType: "quote",
        aggregateId: quoteId,
        eventType: "quote.negotiationRequested",
        payload: { quoteId, negotiationId: inserted!.id, contactId, baseVersionNumber, requestedChanges: parsed.data.changes } as any,
      });

      const response = { id: inserted!.id, quoteId, status: inserted!.status, baseVersionNumber, message: inserted!.message, requestedChanges: inserted!.requestedChanges, createdAt: inserted!.createdAt, quoteStatus: updatedQuote.status };

      if (idempotencyKey) {
        await storeIdempotency(tx as any, { tenantId, actorId: contactId, operation: `portal.negotiation:${quoteId}`, key: idempotencyKey, responseStatus: "202", responseBody: response });
      }

      return { data: response, status: 202, fromIdempotency: false };
    });

    if ((result as any).fromIdempotency) res.status((result as any).status).json({ data: (result as any).data });
    else res.status((result as any).status).json({ data: (result as any).data });
  } catch (e) {
    next(e);
  }
});

// POST /portal/quotes/:id/accept — idempotent, exact shared version
const acceptSchema = z.object({ acceptedTermsVersion: z.number().int().min(1) }).strict();

portalQuotesRouter.post("/quotes/:id/accept", async (req, res, next) => {
  try {
    const quoteId = req.params.id as string;
    if (!/^[0-9a-f-]{36}$/i.test(quoteId)) throw new ApiError(400, "BAD_REQUEST", "Invalid quote id");
    const parsed = acceptSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const ctx = req.portalAuth!;
    const { tenantId, contactId } = ctx;
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    const requestId = (req as unknown as { requestId: string }).requestId;

    const result = await withTenantTransaction({ tenantId, actorId: contactId, requestId }, async (tx) => {
      if (idempotencyKey) {
        const existing = await findIdempotency(tx as any, { tenantId, actorId: contactId, operation: `portal.accept:${quoteId}`, key: idempotencyKey });
        if (existing) return { data: existing.responseBody as any, status: Number(existing.responseStatus ?? 200), fromIdempotency: true };
      }

      const shareRows = await tx.select().from(schema.quoteShares).where(and(eq(schema.quoteShares.tenantId, tenantId), eq(schema.quoteShares.quoteId, quoteId), eq(schema.quoteShares.contactId, contactId)));
      const active = shareRows.filter(isShareActive);
      if (active.length === 0) throw new ApiError(404, "NOT_FOUND", "Quote not found or not shared or share expired/revoked");

      const share = active[0] as typeof schema.quoteShares.$inferSelect;
      if (share.versionNumber !== parsed.data.acceptedTermsVersion) throw new ApiError(422, "UNPROCESSABLE", "Accepted version does not match shared version", { sharedVersion: share.versionNumber, acceptedVersion: parsed.data.acceptedTermsVersion });

      const qRows = await tx.select().from(schema.quotes).where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, tenantId))).limit(1);
      const quote = qRows[0];
      if (!quote) throw new ApiError(404, "NOT_FOUND", "Quote not found");

      if (quote.currentVersion !== parsed.data.acceptedTermsVersion) throw new ApiError(422, "UNPROCESSABLE", "Quote version mismatch", { currentVersion: quote.currentVersion, acceptedVersion: parsed.data.acceptedTermsVersion });

      // verify quote/version/status valid
      if (!["sharedWithCustomer", "underNegotiation", "customerAccepted", "readyForOrder"].includes(quote.status)) throw new ApiError(422, "UNPROCESSABLE", `Quote not accept-able in status ${quote.status}`);

      // idempotency of already accepted
      if (["customerAccepted", "readyForOrder"].includes(quote.status)) {
        // already accepted — return existing quote portal model idempotently
        const portalModel = await buildPortalQuoteModel(tx, tenantId, quote);
        const response = { quote: portalModel, acceptedVersion: parsed.data.acceptedTermsVersion, status: quote.status };
        if (idempotencyKey) {
          await storeIdempotency(tx as any, { tenantId, actorId: contactId, operation: `portal.accept:${quoteId}`, key: idempotencyKey, responseStatus: "200", responseBody: response });
        }
        return { data: response, status: 200, fromIdempotency: false };
      }

      // Also verify no other customer's share is being misused — already filtered by contactId
      // Verify share's versionId still corresponds to immutable version snapshot
      // Could check quoteVersions exists
      const versionRows = await tx.select().from(schema.quoteVersions).where(and(eq(schema.quoteVersions.quoteId, quoteId), eq(schema.quoteVersions.versionNumber, parsed.data.acceptedTermsVersion))).limit(1);
      if (!versionRows[0]) throw new ApiError(422, "UNPROCESSABLE", "Shared version not found");

      // Transition: sharedWithCustomer/underNegotiation -> readyForOrder (or customerAccepted)
      // For simplicity, go directly to readyForOrder as we have no reapproval policy tied to portal acceptance in this phase
      // However we will first go to customerAccepted then readyForOrder — choose readyForOrder as final
      // If we wanted reapproval: check riskLevel? but after share, risk is already evaluated.
      // We'll set to readyForOrder.
      const newStatus = "readyForOrder";
      const [updated] = await tx
        .update(schema.quotes)
        .set({ status: newStatus as any, updatedAt: new Date() })
        .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, tenantId)))
        .returning();
      if (!updated) throw new ApiError(409, "VERSION_CONFLICT", "Quote changed");

      await writeAuditEvent(tx as any, {
        tenantId,
        actorId: contactId,
        action: "portal.accept",
        entityType: "quote",
        entityId: quoteId,
        requestId,
        detail: { acceptedTermsVersion: parsed.data.acceptedTermsVersion, previousStatus: quote.status, newStatus } as any,
      });

      await tx.insert(schema.outboxEvents).values({
        tenantId,
        aggregateType: "quote",
        aggregateId: quoteId,
        eventType: "quote.customerAccepted",
        payload: { quoteId, acceptedVersion: parsed.data.acceptedTermsVersion, contactId, newStatus } as any,
      });

      const portalModel = await buildPortalQuoteModel(tx, tenantId, updated);
      const response = { quote: portalModel, acceptedVersion: parsed.data.acceptedTermsVersion, status: updated.status };

      if (idempotencyKey) {
        await storeIdempotency(tx as any, { tenantId, actorId: contactId, operation: `portal.accept:${quoteId}`, key: idempotencyKey, responseStatus: "200", responseBody: response });
      }

      return { data: response, status: 200, fromIdempotency: false };
    });

    if ((result as any).fromIdempotency) res.status((result as any).status).json({ data: (result as any).data });
    else res.status((result as any).status).json({ data: (result as any).data });
  } catch (e) {
    next(e);
  }
});

// GET /portal/orders — customer-safe order list
portalQuotesRouter.get("/orders", async (req, res, next) => {
  try {
    const ctx = req.portalAuth!;
    const { tenantId, contactId } = ctx;

    const rows = await withTenantTransaction({ tenantId }, async (tx) => {
      const [contact] = await tx
        .select()
        .from(schema.customerContacts)
        .where(and(eq(schema.customerContacts.tenantId, tenantId), eq(schema.customerContacts.id, contactId)))
        .limit(1);

      if (!contact) throw new ApiError(401, "UNAUTHORIZED", "Contact not found");

      const orders = await OrdersService.listOrders(tx, {
        tenantId,
        customerId: contact.customerId,
        limit: 50,
      });
      return orders.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        currency: o.currency,
        grandTotal: o.grandTotal,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      }));
    });

    return res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// GET /portal/orders/:id — customer-safe order detail
portalQuotesRouter.get("/orders/:id", async (req, res, next) => {
  try {
    const ctx = req.portalAuth!;
    const { tenantId, contactId } = ctx;
    const orderId = req.params.id;

    const order = await withTenantTransaction({ tenantId }, async (tx) => {
      const [contact] = await tx
        .select()
        .from(schema.customerContacts)
        .where(and(eq(schema.customerContacts.tenantId, tenantId), eq(schema.customerContacts.id, contactId)))
        .limit(1);

      if (!contact) throw new ApiError(401, "UNAUTHORIZED", "Contact not found");

      return OrdersService.getPortalOrderById(tx, tenantId, contact.customerId, orderId);
    });

    return res.json({ data: order });
  } catch (e) {
    next(e);
  }
});


export default portalQuotesRouter;

