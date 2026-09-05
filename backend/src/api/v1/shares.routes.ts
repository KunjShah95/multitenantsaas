import { Router } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";
import { ApiError } from "../../shared/errors.js";
import { withTenantTransaction } from "../../db/transaction.js";
import { writeAuditEvent } from "../../shared/audit.js";
import { findIdempotency, storeIdempotency } from "../../shared/idempotency.js";
import * as schema from "../../db/schema/index.js";
import { getEmailAdapter } from "../../integrations/email/index.js";

export const sharesRouter = Router();

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

const shareCreateSchema = z
  .object({
    customerContactIds: z.array(z.string().uuid()).min(1).max(20),
    expiresAt: z.string().datetime().nullable().optional(),
    message: z.string().max(1000).nullable().optional(),
  })
  .strict();

// POST /quotes/:id/share — idempotent internal share
sharesRouter.post("/quotes/:id/share", authenticate, async (req, res, next) => {
  try {
    const quoteId = req.params.id as string;
    if (!/^[0-9a-f-]{36}$/i.test(quoteId))
      throw new ApiError(400, "BAD_REQUEST", "Invalid quote id");
    const parsed = shareCreateSchema.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId, role } = getCtx(req);
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

    // dedupe contact ids
    const contactIds = [...new Set(parsed.data.customerContactIds)];

    let expiresAt: Date | null = null;
    if (parsed.data.expiresAt) {
      expiresAt = new Date(parsed.data.expiresAt);
      if (Number.isNaN(expiresAt.getTime()))
        throw new ApiError(400, "BAD_REQUEST", "Invalid expiresAt");
      if (expiresAt <= new Date())
        throw new ApiError(400, "BAD_REQUEST", "expiresAt must be in future");
    }

    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      if (idempotencyKey) {
        const existing = await findIdempotency(tx as any, {
          tenantId,
          actorId,
          operation: `quote.share:${quoteId}`,
          key: idempotencyKey,
        });
        if (existing)
          return {
            data: existing.responseBody as any,
            status: Number(existing.responseStatus ?? 201),
            fromIdempotency: true,
          };
      }

      const qRows = await tx
        .select()
        .from(schema.quotes)
        .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, tenantId)))
        .limit(1);
      const quote = qRows[0];
      if (!quote) throw new ApiError(404, "NOT_FOUND", "Quote not found");

      // Share only an internally approved version; validate safe status
      if (!["approvedInternal", "sharedWithCustomer", "underNegotiation"].includes(quote.status)) {
        throw new ApiError(
          422,
          "UNPROCESSABLE",
          `Quote not shareable in status ${quote.status} — must be internally approved`,
        );
      }

      // Must have at least one version snapshot approvedInternal; ensure version exists
      const versionRows = await tx
        .select()
        .from(schema.quoteVersions)
        .where(
          and(
            eq(schema.quoteVersions.quoteId, quoteId),
            eq(schema.quoteVersions.versionNumber, quote.currentVersion),
          ),
        )
        .limit(1);
      const version = versionRows[0];
      if (!version)
        throw new ApiError(422, "UNPROCESSABLE", "Quote version snapshot not found for sharing");

      // Authorization: admin or owner/team rep/manager can share
      if (role !== "admin") {
        const auth = req.auth!;
        const memRows = await tx
          .select()
          .from(schema.memberships)
          .where(
            and(
              eq(schema.memberships.userId, auth.userId),
              eq(schema.memberships.tenantId, tenantId),
            ),
          )
          .limit(1);
        const mem = memRows[0];
        const team = mem?.teamId;
        const isOwner = quote.ownerUserId === auth.userId;
        const isTeam = team && quote.teamId === team;
        const allowedRoles = ["rep", "manager", "admin"];
        if (!allowedRoles.includes(role) || (!isOwner && !isTeam && role !== "admin")) {
          // rep can share own/team quotes; manager can share team; admin all
          if (!isOwner && !isTeam) throw new ApiError(403, "FORBIDDEN", "Not owner or team member");
        }
      }

      const createdShares: any[] = [];
      const adapter = getEmailAdapter();

      for (const contactId of contactIds) {
        const contactRows = await tx
          .select()
          .from(schema.customerContacts)
          .where(
            and(
              eq(schema.customerContacts.id, contactId),
              eq(schema.customerContacts.tenantId, tenantId),
            ),
          )
          .limit(1);
        const contact = contactRows[0];
        if (!contact)
          throw new ApiError(400, "BAD_REQUEST", `Contact ${contactId} not found in tenant`);
        // validate customer relationship
        const custRows = await tx
          .select()
          .from(schema.customers)
          .where(
            and(
              eq(schema.customers.id, contact.customerId),
              eq(schema.customers.tenantId, tenantId),
            ),
          )
          .limit(1);
        const customer = custRows[0];
        if (!customer || customer.archivedAt)
          throw new ApiError(
            400,
            "BAD_REQUEST",
            `Customer for contact ${contactId} not found or archived`,
          );
        // ensure contact's customer matches quote's customer? Spec says validate contact/customer/tenant — share only customer's quote?
        // Quote's customer must match contact's customer
        if (contact.customerId !== quote.customerId)
          throw new ApiError(
            400,
            "BAD_REQUEST",
            `Contact ${contactId} does not belong to quote's customer`,
          );

        // Check existing share for same version
        const existingShares = await tx
          .select()
          .from(schema.quoteShares)
          .where(
            and(
              eq(schema.quoteShares.quoteId, quoteId),
              eq(schema.quoteShares.contactId, contactId),
              eq(schema.quoteShares.versionNumber, quote.currentVersion),
            ),
          )
          .limit(1);
        const shareRow = existingShares[0];
        if (shareRow) {
          // if active and not revoked/expired, return existing without creating
          if (
            !shareRow.revokedAt &&
            (!shareRow.expiresAt || new Date(shareRow.expiresAt) > new Date())
          ) {
            createdShares.push(shareRow);
            continue;
          }
          // if revoked, we update it to re-activate (extend expiry, clear revoked)
          if (shareRow.revokedAt) {
            const [upd] = await tx
              .update(schema.quoteShares)
              .set({
                revokedAt: null,
                revokedBy: null,
                expiresAt,
                message: parsed.data.message ?? shareRow.message,
                updatedAt: new Date(),
              })
              .where(eq(schema.quoteShares.id, shareRow.id))
              .returning();
            createdShares.push(upd);
            // send email again
            await adapter
              .send({
                to: contact.email,
                subject: `Quote ${quote.number} shared`,
                text: `Quote ${quote.number} has been shared with you. ${parsed.data.message ?? ""}`,
                html: `<p>Quote ${quote.number} shared. ${parsed.data.message ?? ""}</p>`,
              })
              .catch(() => {});
            continue;
          }
          // if expired, update expiry
          if (shareRow.expiresAt && new Date(shareRow.expiresAt) <= new Date() && expiresAt) {
            const [upd] = await tx
              .update(schema.quoteShares)
              .set({ expiresAt, updatedAt: new Date() })
              .where(eq(schema.quoteShares.id, shareRow.id))
              .returning();
            createdShares.push(upd);
            continue;
          }
          // otherwise push existing expired without change? but we should extend?
          createdShares.push(shareRow);
          continue;
        }

        // insert new share
        try {
          const [inserted] = await tx
            .insert(schema.quoteShares)
            .values({
              tenantId,
              quoteId,
              versionId: version.id,
              versionNumber: quote.currentVersion,
              contactId,
              customerId: customer.id,
              createdBy: actorId,
              expiresAt,
              message: parsed.data.message ?? null,
            })
            .returning();
          createdShares.push(inserted);
          // queue console/Resend invitation through adapter (invite email)
          await adapter
            .send({
              to: contact.email,
              subject: `Quote ${quote.number} shared`,
              text: `Quote ${quote.number} has been shared with you. ${parsed.data.message ?? ""} Expires: ${expiresAt ? expiresAt.toISOString() : "never"}`,
              html: `<p>Quote <b>${quote.number}</b> has been shared with you.</p><p>${parsed.data.message ?? ""}</p>`,
            })
            .catch(() => {
              // email failure should not fail share; outbox covers retry in later phase
            });
        } catch (e: any) {
          const code = e.code ?? e.cause?.code;
          if (code === "23505") {
            // unique violation — fetch existing
            const dup = await tx
              .select()
              .from(schema.quoteShares)
              .where(
                and(
                  eq(schema.quoteShares.quoteId, quoteId),
                  eq(schema.quoteShares.contactId, contactId),
                  eq(schema.quoteShares.versionNumber, quote.currentVersion),
                ),
              )
              .limit(1);
            if (dup[0]) createdShares.push(dup[0]);
          } else throw e;
        }
      }

      // Transition quote status to sharedWithCustomer if it was approvedInternal
      let updatedQuote = quote;
      if (quote.status === "approvedInternal") {
        const [uq] = await tx
          .update(schema.quotes)
          .set({ status: "sharedWithCustomer" as any, updatedAt: new Date() })
          .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, tenantId)))
          .returning();
        if (uq) updatedQuote = uq;
      }

      await writeAuditEvent(tx as any, {
        tenantId,
        actorId,
        action: "quote.share",
        entityType: "quote",
        entityId: quoteId,
        requestId,
        detail: {
          contactIds,
          versionNumber: quote.currentVersion,
          expiresAt: expiresAt?.toISOString() ?? null,
          quoteStatus: updatedQuote.status,
        } as any,
      });

      await tx.insert(schema.outboxEvents).values({
        tenantId,
        aggregateType: "quote",
        aggregateId: quoteId,
        eventType: "quote.shared",
        payload: { quoteId, shares: createdShares, versionNumber: quote.currentVersion } as any,
      });

      const response = { quote: updatedQuote, shares: createdShares };

      if (idempotencyKey) {
        await storeIdempotency(tx as any, {
          tenantId,
          actorId,
          operation: `quote.share:${quoteId}`,
          key: idempotencyKey,
          responseStatus: "201",
          responseBody: response,
        });
      }

      return { data: response, status: 201, fromIdempotency: false };
    });

    if ((result as any).fromIdempotency)
      res.status((result as any).status).json({ data: (result as any).data });
    else res.status((result as any).status).json({ data: (result as any).data });
  } catch (e) {
    next(e);
  }
});

// POST /quotes/:id/shares/:shareId/revoke
sharesRouter.post("/quotes/:id/shares/:shareId/revoke", authenticate, async (req, res, next) => {
  try {
    const quoteId = req.params.id as string;
    const shareId = req.params.shareId as string;
    if (!/^[0-9a-f-]{36}$/i.test(quoteId) || !/^[0-9a-f-]{36}$/i.test(shareId))
      throw new ApiError(400, "BAD_REQUEST", "Invalid id");
    const { tenantId, actorId, requestId, role } = getCtx(req);
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      if (idempotencyKey) {
        const existing = await findIdempotency(tx as any, {
          tenantId,
          actorId,
          operation: `quote.share.revoke:${shareId}`,
          key: idempotencyKey,
        });
        if (existing)
          return {
            data: existing.responseBody as any,
            status: Number(existing.responseStatus ?? 200),
            fromIdempotency: true,
          };
      }

      const qRows = await tx
        .select()
        .from(schema.quotes)
        .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, tenantId)))
        .limit(1);
      const quote = qRows[0];
      if (!quote) throw new ApiError(404, "NOT_FOUND", "Quote not found");

      const shareRows = await tx
        .select()
        .from(schema.quoteShares)
        .where(
          and(
            eq(schema.quoteShares.id, shareId),
            eq(schema.quoteShares.tenantId, tenantId),
            eq(schema.quoteShares.quoteId, quoteId),
          ),
        )
        .limit(1);
      const share = shareRows[0];
      if (!share) throw new ApiError(404, "NOT_FOUND", "Share not found");
      if (share.revokedAt) {
        const response = { share };
        if (idempotencyKey)
          await storeIdempotency(tx as any, {
            tenantId,
            actorId,
            operation: `quote.share.revoke:${shareId}`,
            key: idempotencyKey,
            responseStatus: "200",
            responseBody: response,
          });
        return { data: response, status: 200, fromIdempotency: false };
      }

      // Authorization: admin or owner/team rep/manager can revoke
      if (role !== "admin") {
        const auth = req.auth!;
        const memRows = await tx
          .select()
          .from(schema.memberships)
          .where(
            and(
              eq(schema.memberships.userId, auth.userId),
              eq(schema.memberships.tenantId, tenantId),
            ),
          )
          .limit(1);
        const mem = memRows[0];
        const team = mem?.teamId;
        const isOwner = quote.ownerUserId === auth.userId;
        const isTeam = team && quote.teamId === team;
        if (!isOwner && !isTeam) throw new ApiError(403, "FORBIDDEN", "Not owner or team member");
      }

      const [updated] = await tx
        .update(schema.quoteShares)
        .set({ revokedAt: new Date(), revokedBy: actorId, updatedAt: new Date() })
        .where(eq(schema.quoteShares.id, shareId))
        .returning();

      await writeAuditEvent(tx as any, {
        tenantId,
        actorId,
        action: "quote.share.revoke",
        entityType: "quote_share",
        entityId: shareId,
        requestId,
        detail: { quoteId } as any,
      });

      await tx.insert(schema.outboxEvents).values({
        tenantId,
        aggregateType: "quote",
        aggregateId: quoteId,
        eventType: "quote.shareRevoked",
        payload: { quoteId, shareId, revokedBy: actorId } as any,
      });

      const response = { share: updated };
      if (idempotencyKey)
        await storeIdempotency(tx as any, {
          tenantId,
          actorId,
          operation: `quote.share.revoke:${shareId}`,
          key: idempotencyKey,
          responseStatus: "200",
          responseBody: response,
        });
      return { data: response, status: 200, fromIdempotency: false };
    });

    if ((result as any).fromIdempotency)
      res.status((result as any).status).json({ data: (result as any).data });
    else res.status((result as any).status).json({ data: (result as any).data });
  } catch (e) {
    next(e);
  }
});

// GET /quotes/:id/negotiation-requests — rep list
sharesRouter.get("/quotes/:id/negotiation-requests", authenticate, async (req, res, next) => {
  try {
    const quoteId = req.params.id as string;
    if (!/^[0-9a-f-]{36}$/i.test(quoteId))
      throw new ApiError(400, "BAD_REQUEST", "Invalid quote id");
    const { tenantId, role, userId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId }, async (tx) => {
      const qRows = await tx
        .select()
        .from(schema.quotes)
        .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, tenantId)))
        .limit(1);
      const quote = qRows[0];
      if (!quote) throw new ApiError(404, "NOT_FOUND", "Quote not found");
      if (role !== "admin") {
        const memRows = await tx
          .select()
          .from(schema.memberships)
          .where(
            and(eq(schema.memberships.userId, userId), eq(schema.memberships.tenantId, tenantId)),
          )
          .limit(1);
        const mem = memRows[0];
        const team = mem?.teamId;
        const isOwner = quote.ownerUserId === userId;
        const isTeam = team && quote.teamId === team;
        const isMgr = ["manager", "rep"].includes(role);
        if (!isOwner && !isTeam && !isMgr) throw new ApiError(404, "NOT_FOUND", "Quote not found");
      }
      const reqs = await tx
        .select()
        .from(schema.negotiationRequests)
        .where(
          and(
            eq(schema.negotiationRequests.tenantId, tenantId),
            eq(schema.negotiationRequests.quoteId, quoteId),
          ),
        )
        .orderBy(desc(schema.negotiationRequests.createdAt));
      return {
        quote: {
          id: quote.id,
          status: quote.status,
          revision: quote.revision,
          currentVersion: quote.currentVersion,
        },
        negotiationRequests: reqs,
      };
    });
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

const resolveSchema = z
  .object({
    action: z.enum(["decline", "requestClarification", "acceptAsRevision"]),
    message: z.string().max(2000).optional().nullable(),
  })
  .strict();

// POST /quotes/:id/negotiation-requests/:requestId/resolve — idempotent
sharesRouter.post(
  "/quotes/:id/negotiation-requests/:requestId/resolve",
  authenticate,
  async (req, res, next) => {
    try {
      const quoteId = req.params.id as string;
      const requestIdParam = req.params.requestId as string;
      if (!/^[0-9a-f-]{36}$/i.test(quoteId) || !/^[0-9a-f-]{36}$/i.test(requestIdParam))
        throw new ApiError(400, "BAD_REQUEST", "Invalid id");
      const parsed = resolveSchema.safeParse(req.body);
      if (!parsed.success)
        throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
      const { tenantId, actorId, requestId, role, userId } = getCtx(req);
      const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

      const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
        if (idempotencyKey) {
          const existing = await findIdempotency(tx as any, {
            tenantId,
            actorId,
            operation: `quote.negotiation.resolve:${requestIdParam}`,
            key: idempotencyKey,
          });
          if (existing)
            return {
              data: existing.responseBody as any,
              status: Number(existing.responseStatus ?? 200),
              fromIdempotency: true,
            };
        }

        const qRows = await tx
          .select()
          .from(schema.quotes)
          .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, tenantId)))
          .limit(1);
        const quote = qRows[0];
        if (!quote) throw new ApiError(404, "NOT_FOUND", "Quote not found");
        if (role !== "admin" && !["rep", "manager"].includes(role))
          throw new ApiError(403, "FORBIDDEN", "Only rep/manager/admin can resolve");

        // ownership/team check
        if (role !== "admin") {
          const memRows = await tx
            .select()
            .from(schema.memberships)
            .where(
              and(eq(schema.memberships.userId, userId), eq(schema.memberships.tenantId, tenantId)),
            )
            .limit(1);
          const mem = memRows[0];
          const team = mem?.teamId;
          const isOwner = quote.ownerUserId === userId;
          const isTeam = team && quote.teamId === team;
          if (!isOwner && !isTeam) throw new ApiError(403, "FORBIDDEN", "Not owner or team member");
        }

        const rRows = await tx
          .select()
          .from(schema.negotiationRequests)
          .where(
            and(
              eq(schema.negotiationRequests.id, requestIdParam),
              eq(schema.negotiationRequests.tenantId, tenantId),
              eq(schema.negotiationRequests.quoteId, quoteId),
            ),
          )
          .limit(1);
        const nego = rRows[0];
        if (!nego) throw new ApiError(404, "NOT_FOUND", "Negotiation request not found");
        if (nego.status !== "pending")
          throw new ApiError(409, "CONFLICT", `Negotiation already resolved (${nego.status})`);

        let newStatus: string;
        if (parsed.data.action === "decline") newStatus = "declined";
        else if (parsed.data.action === "requestClarification")
          newStatus = "clarification_requested";
        else newStatus = "accepted_as_revision";

        let updatedNegotiation: any = null;
        let updatedQuote: any = quote;

        if (parsed.data.action === "acceptAsRevision") {
          // Creating editable revision for normal resubmission — must not mutate commercial terms in place
          // Increment revision and currentVersion, create new version snapshot copying current lines/totals
          const lines = await tx
            .select()
            .from(schema.quoteLines)
            .where(
              and(eq(schema.quoteLines.quoteId, quoteId), eq(schema.quoteLines.tenantId, tenantId)),
            );
          const newVersionNumber = quote.currentVersion + 1;
          const newRevision = quote.revision + 1;

          const [uq] = await tx
            .update(schema.quotes)
            .set({
              status: "draft" as any,
              revision: newRevision,
              currentVersion: newVersionNumber,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.quotes.id, quoteId),
                eq(schema.quotes.tenantId, tenantId),
                eq(schema.quotes.revision, quote.revision),
              ),
            )
            .returning();
          if (!uq) {
            const cur = await tx
              .select()
              .from(schema.quotes)
              .where(eq(schema.quotes.id, quoteId))
              .limit(1)
              .then((r: any) => r[0]);
            throw new ApiError(409, "VERSION_CONFLICT", "Quote changed", {
              currentRevision: cur?.revision ?? quote.revision,
            });
          }
          updatedQuote = uq;

          const snapshot = {
            quote: uq,
            lines,
            baseNegotiation: {
              negotiationId: nego.id,
              baseVersionNumber: nego.baseVersionNumber,
              requestedChanges: nego.requestedChanges,
            },
            note: "Revision created from negotiation acceptAsRevision — requestedChanges stored but not auto-applied; rep must edit and resubmit",
            acceptedBy: actorId,
            acceptedAt: new Date().toISOString(),
          };

          await tx.insert(schema.quoteVersions).values({
            tenantId,
            quoteId,
            versionNumber: newVersionNumber,
            revision: newRevision,
            snapshot: snapshot as any,
            createdBy: actorId,
          });

          // update negotiation with revisionCreated
          const [un] = await tx
            .update(schema.negotiationRequests)
            .set({
              status: newStatus as any,
              resolutionMessage: parsed.data.message ?? null,
              resolvedBy: actorId,
              resolvedAt: new Date(),
              revisionCreated: newVersionNumber,
              updatedAt: new Date(),
            })
            .where(eq(schema.negotiationRequests.id, requestIdParam))
            .returning();
          updatedNegotiation = un;

          // invalidate other pending negotiations for same base? mark superseded?
          // Not needed; they remain pending but could be superseded by new revision
        } else {
          const [un] = await tx
            .update(schema.negotiationRequests)
            .set({
              status: newStatus as any,
              resolutionMessage: parsed.data.message ?? null,
              resolvedBy: actorId,
              resolvedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.negotiationRequests.id, requestIdParam))
            .returning();
          updatedNegotiation = un;
        }

        await writeAuditEvent(tx as any, {
          tenantId,
          actorId,
          action: "quote.negotiation.resolve",
          entityType: "negotiation_request",
          entityId: requestIdParam,
          requestId,
          detail: {
            quoteId,
            action: parsed.data.action,
            previousStatus: nego.status,
            newStatus,
          } as any,
        });

        await tx.insert(schema.outboxEvents).values({
          tenantId,
          aggregateType: "quote",
          aggregateId: quoteId,
          eventType: "quote.negotiationResolved",
          payload: {
            quoteId,
            negotiationId: requestIdParam,
            action: parsed.data.action,
            newStatus,
            quoteRevision: updatedQuote.revision,
            quoteVersion: updatedQuote.currentVersion,
          } as any,
        });

        const response = { negotiation: updatedNegotiation, quote: updatedQuote };
        if (idempotencyKey)
          await storeIdempotency(tx as any, {
            tenantId,
            actorId,
            operation: `quote.negotiation.resolve:${requestIdParam}`,
            key: idempotencyKey,
            responseStatus: "200",
            responseBody: response,
          });
        return { data: response, status: 200, fromIdempotency: false };
      });

      if ((result as any).fromIdempotency)
        res.status((result as any).status).json({ data: (result as any).data });
      else res.status((result as any).status).json({ data: (result as any).data });
    } catch (e) {
      next(e);
    }
  },
);

export default sharesRouter;
