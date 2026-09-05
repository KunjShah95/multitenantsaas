import { Router } from "express";
import { z } from "zod";
import { eq, and, desc, asc } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";
import { ApiError } from "../../shared/errors.js";
import { withTenantTransaction } from "../../db/transaction.js";
import { writeAuditEvent } from "../../shared/audit.js";
import { findIdempotency, storeIdempotency } from "../../shared/idempotency.js";
import { paginationQuerySchema, encodeCursor, decodeCursor } from "../../shared/pagination.js";
import * as schema from "../../db/schema/index.js";
import { evaluateRisk } from "../../domain/quotes/risk.js";

export const approvalsRouter = Router();
approvalsRouter.use(authenticate);

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
  if (!header)
    throw new ApiError(400, "BAD_REQUEST", "If-Match header required", {
      hint: 'Send If-Match: W/"<revision>"',
    });
  const match = header.match(/W\/"(\d+)"|"(\d+)"|(\d+)/);
  const numStr = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!numStr) throw new ApiError(400, "BAD_REQUEST", "Invalid If-Match header");
  const n = Number(numStr);
  if (!Number.isInteger(n) || n < 1)
    throw new ApiError(400, "BAD_REQUEST", "Invalid revision in If-Match");
  return n;
}

async function getEffectiveDiscountSnapshot(tx: any, tenantId: string) {
  const now = new Date();
  const policies = await tx
    .select()
    .from(schema.discountPolicies)
    .where(
      and(
        eq(schema.discountPolicies.tenantId, tenantId),
        eq(schema.discountPolicies.status, "published"),
      ),
    );
  const effective = policies.filter((p: any) => {
    const fromOk = !p.effectiveFrom || new Date(p.effectiveFrom) <= now;
    const toOk = !p.effectiveTo || new Date(p.effectiveTo) > now;
    return fromOk && toOk && !p.archivedAt;
  });
  if (effective.length === 0) return null;
  effective.sort((a: any, b: any) => {
    const aTime = a.publishedAt
      ? new Date(a.publishedAt).getTime()
      : new Date(a.createdAt).getTime();
    const bTime = b.publishedAt
      ? new Date(b.publishedAt).getTime()
      : new Date(b.createdAt).getTime();
    return bTime - aTime;
  });
  const policy = effective[0];
  const tierLimits = await tx
    .select()
    .from(schema.discountTierLimits)
    .where(eq(schema.discountTierLimits.policyId, policy.id));
  const catLimits = await tx
    .select()
    .from(schema.discountCategoryLimits)
    .where(eq(schema.discountCategoryLimits.policyId, policy.id));
  return { policy, tierLimits, catLimits };
}

async function getEffectiveApprovalSnapshot(tx: any, tenantId: string) {
  const now = new Date();
  const policies = await tx
    .select()
    .from(schema.approvalPolicies)
    .where(
      and(
        eq(schema.approvalPolicies.tenantId, tenantId),
        eq(schema.approvalPolicies.status, "published"),
      ),
    );
  const effective = policies.filter((p: any) => {
    const f = !p.effectiveFrom || new Date(p.effectiveFrom) <= now;
    const t = !p.effectiveTo || new Date(p.effectiveTo) > now;
    return f && t && !p.archivedAt;
  });
  if (effective.length === 0) return null;
  effective.sort((a: any, b: any) => {
    const aTime = a.publishedAt
      ? new Date(a.publishedAt).getTime()
      : new Date(a.createdAt).getTime();
    const bTime = b.publishedAt
      ? new Date(b.publishedAt).getTime()
      : new Date(b.createdAt).getTime();
    return bTime - aTime;
  });
  const policy = effective[0];
  const steps = await tx
    .select()
    .from(schema.approvalPolicySteps)
    .where(eq(schema.approvalPolicySteps.policyId, policy.id));
  steps.sort((a: any, b: any) => a.sequence - b.sequence);
  return { policy, steps };
}

// ---------- Submit ----------
const submitSchema = z.object({ note: z.string().max(1000).optional() }).strict();

approvalsRouter.post("/quotes/:id/submit", async (req, res, next) => {
  try {
    const parsed = submitSchema.safeParse(req.body ?? {});
    if (!parsed.success)
      throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const quoteId = req.params.id as string;
    if (!/^[0-9a-f-]{36}$/i.test(quoteId))
      throw new ApiError(400, "BAD_REQUEST", "Invalid quote id");
    const expectedRevision = parseIfMatch(req);
    const { tenantId, actorId, requestId, role } = getCtx(req);
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      if (idempotencyKey) {
        const existing = await findIdempotency(tx as any, {
          tenantId,
          actorId,
          operation: `quote.submit:${quoteId}`,
          key: idempotencyKey,
        });
        if (existing) {
          return {
            data: existing.responseBody as any,
            status: Number(existing.responseStatus ?? 200),
            fromIdempotency: true,
          };
        }
      }

      const rows = await tx
        .select()
        .from(schema.quotes)
        .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, tenantId)))
        .limit(1);
      const quote = rows[0];
      if (!quote) throw new ApiError(404, "NOT_FOUND", "Quote not found");
      if (quote.revision !== expectedRevision)
        throw new ApiError(409, "VERSION_CONFLICT", "The quote changed. Reload and try again.", {
          currentRevision: quote.revision,
        });

      // authorization: rep/admin can submit own/team quotes
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

      // status check
      if (!["draft", "returnedForRevision"].includes(quote.status)) {
        throw new ApiError(422, "UNPROCESSABLE", `Quote not submittable in status ${quote.status}`);
      }

      // fetch lines and customer
      const lines = await tx
        .select()
        .from(schema.quoteLines)
        .where(
          and(eq(schema.quoteLines.quoteId, quoteId), eq(schema.quoteLines.tenantId, tenantId)),
        )
        .orderBy(asc(schema.quoteLines.createdAt));
      const custRows = await tx
        .select()
        .from(schema.customers)
        .where(
          and(eq(schema.customers.id, quote.customerId), eq(schema.customers.tenantId, tenantId)),
        )
        .limit(1);
      const customer = custRows[0];
      if (!customer || customer.archivedAt)
        throw new ApiError(400, "BAD_REQUEST", "Customer not found or archived");

      // fetch effective policy snapshots
      const discountSnap = await getEffectiveDiscountSnapshot(tx, tenantId);
      const approvalSnap = await getEffectiveApprovalSnapshot(tx, tenantId);

      const discountPolicySnapshotForEval = discountSnap
        ? {
            tierLimits: discountSnap.tierLimits.map((t: any) => ({
              tierCode: t.tierCode,
              ceilingPct: t.ceilingPct,
            })),
            categoryLimits: discountSnap.catLimits.map((c: any) => ({
              categoryCode: c.categoryCode,
              ceilingPct: c.ceilingPct,
            })),
          }
        : null;
      const approvalPolicySnapshotForEval = approvalSnap
        ? {
            steps: approvalSnap.steps.map((s: any) => ({
              sequence: s.sequence,
              role: s.role,
              name: s.name,
            })),
          }
        : null;

      // evaluate risk pure
      const riskInputLines = lines.map((l: any) => ({
        discountPct: l.discountPct,
        subtotal: l.lineSubtotal,
        categoryCode: l.snapshotCategoryCode ?? null,
      }));
      const evaluation = evaluateRisk({
        lines: riskInputLines,
        customerTierCode: customer.tierCode ?? null,
        discountPolicy: discountPolicySnapshotForEval,
        approvalPolicy: approvalPolicySnapshotForEval,
        orderDiscountPct: null,
      });

      // snapshot data to freeze
      const versionNumber = quote.currentVersion + 1;
      const snapshot = {
        quote: {
          ...quote,
          revision: quote.revision + 1,
          version: versionNumber,
          status: evaluation.level === "none" ? "approvedInternal" : "awaitingApproval",
        },
        lines,
        totals: {
          subtotal: quote.subtotal,
          discountTotal: quote.discountTotal,
          netTotal: quote.netTotal,
          taxTotal: quote.taxTotal,
          grandTotal: quote.grandTotal,
          marginTotal: quote.marginTotal,
          marginPct: quote.marginPct,
        },
        risk: evaluation,
        discountPolicy: discountSnap
          ? {
              id: discountSnap.policy.id,
              version: discountSnap.policy.version,
              name: discountSnap.policy.name,
              tierLimits: discountSnap.tierLimits,
              categoryLimits: discountSnap.catLimits,
            }
          : null,
        approvalPolicy: approvalSnap
          ? {
              id: approvalSnap.policy.id,
              version: approvalSnap.policy.version,
              name: approvalSnap.policy.name,
              steps: approvalSnap.steps,
            }
          : null,
        submittedAt: new Date().toISOString(),
        note: parsed.data.note ?? null,
      };

      // Invalidate any pending approvals from previous version (for revision after returned)
      await tx
        .update(schema.quoteApprovals)
        .set({
          status: "invalidated",
          decision: "invalidated",
          reason: "Superseded by new submission",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.quoteApprovals.quoteId, quoteId),
            eq(schema.quoteApprovals.status, "pending"),
          ),
        );

      // increment quote
      const newStatus = evaluation.level === "none" ? "approvedInternal" : "awaitingApproval";
      const [updated] = await tx
        .update(schema.quotes)
        .set({
          status: newStatus,
          revision: quote.revision + 1,
          currentVersion: versionNumber,
          riskScore: evaluation.score as any,
          riskLevel: evaluation.level as any,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.revision, expectedRevision)))
        .returning();
      if (!updated) {
        const cur = await tx
          .select()
          .from(schema.quotes)
          .where(eq(schema.quotes.id, quoteId))
          .limit(1)
          .then((r: any) => r[0]);
        throw new ApiError(409, "VERSION_CONFLICT", "The quote changed. Reload and try again.", {
          currentRevision: cur?.revision ?? quote.revision,
        });
      }

      // create quote_version
      const versionRows = await tx
        .insert(schema.quoteVersions)
        .values({
          tenantId,
          quoteId,
          versionNumber,
          revision: updated.revision,
          snapshot: snapshot as any,
          createdBy: actorId,
        })
        .returning();
      const versionRow = versionRows[0]!;
      if (!versionRow) throw new ApiError(500, "INTERNAL_ERROR", "Failed to create version");

      // create approval steps
      let approvalRows: any[] = [];
      if (evaluation.requiredSteps.length === 0) {
        // auto-approved record for audit explainability
        const autoRows = await tx
          .insert(schema.quoteApprovals)
          .values({
            tenantId,
            quoteId,
            versionId: versionRow.id,
            versionNumber,
            sequence: 1,
            role: role, // not used but track
            status: "auto_approved",
            decision: "approve",
            reason: "Auto-approved: no overage",
            decidedBy: actorId,
            decidedAt: new Date(),
          })
          .returning();
        approvalRows = [autoRows[0]!];
      } else {
        const inserts = evaluation.requiredSteps.map((s) => ({
          tenantId,
          quoteId,
          versionId: versionRow.id,
          versionNumber,
          sequence: s.sequence,
          role: s.role,
          status: "pending" as const,
        }));
        approvalRows = await tx
          .insert(schema.quoteApprovals)
          .values(inserts as any)
          .returning();
        approvalRows.sort((a: any, b: any) => a.sequence - b.sequence);
      }

      await writeAuditEvent(tx as any, {
        tenantId,
        actorId,
        action: "quote.submit",
        entityType: "quote",
        entityId: quoteId,
        requestId,
        detail: { versionNumber, risk: evaluation, note: parsed.data.note ?? null } as any,
      });

      // outbox
      const eventType =
        evaluation.level === "none" ? "quote.autoApproved" : "quote.approvalRequested";
      await tx.insert(schema.outboxEvents).values({
        tenantId,
        aggregateType: "quote",
        aggregateId: quoteId,
        eventType,
        payload: {
          quoteId,
          versionNumber,
          versionId: versionRow.id,
          risk: evaluation,
          approvals: approvalRows,
          note: parsed.data.note ?? null,
        } as any,
      });
      // additional notification outbox entry (delivery worker later)
      await tx.insert(schema.outboxEvents).values({
        tenantId,
        aggregateType: "notification",
        aggregateId: quoteId,
        eventType: "notification.quoteSubmitted",
        payload: { quoteId, versionNumber, status: newStatus, riskLevel: evaluation.level } as any,
      });

      const response = {
        quote: updated,
        version: versionRow,
        risk: evaluation,
        approvals: approvalRows,
        autoApproved: evaluation.level === "none",
      };
      if (idempotencyKey) {
        await storeIdempotency(tx as any, {
          tenantId,
          actorId,
          operation: `quote.submit:${quoteId}`,
          key: idempotencyKey,
          responseStatus: evaluation.level === "none" ? "200" : "202",
          responseBody: response,
        });
      }
      return {
        data: response,
        status: evaluation.level === "none" ? 200 : 202,
        fromIdempotency: false,
      };
    });

    if ((result as any).fromIdempotency) {
      res.status((result as any).status).json({ data: (result as any).data });
    } else {
      res.status((result as any).status).json({ data: (result as any).data });
    }
  } catch (e) {
    next(e);
  }
});

// ---------- List approvals ----------
approvalsRouter.get("/quotes/:id/approvals", async (req, res, next) => {
  try {
    const quoteId = req.params.id as string;
    if (!/^[0-9a-f-]{36}$/i.test(quoteId))
      throw new ApiError(400, "BAD_REQUEST", "Invalid quote id");
    const { tenantId, role, userId } = getCtx(req);

    const result = await withTenantTransaction({ tenantId }, async (tx) => {
      const rows = await tx
        .select()
        .from(schema.quotes)
        .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, tenantId)))
        .limit(1);
      const quote = rows[0];
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
        const isApprover = ["manager", "finance"].includes(role);
        if (!isOwner && !isTeam && !isApprover)
          throw new ApiError(404, "NOT_FOUND", "Quote not found");
      }
      const approvals = await tx
        .select()
        .from(schema.quoteApprovals)
        .where(
          and(
            eq(schema.quoteApprovals.quoteId, quoteId),
            eq(schema.quoteApprovals.tenantId, tenantId),
          ),
        )
        .orderBy(desc(schema.quoteApprovals.versionNumber), asc(schema.quoteApprovals.sequence));
      // also fetch versions for snapshot context
      const versions = await tx
        .select()
        .from(schema.quoteVersions)
        .where(
          and(
            eq(schema.quoteVersions.quoteId, quoteId),
            eq(schema.quoteVersions.tenantId, tenantId),
          ),
        )
        .orderBy(desc(schema.quoteVersions.versionNumber));
      return {
        quote: {
          id: quote.id,
          status: quote.status,
          revision: quote.revision,
          currentVersion: quote.currentVersion,
        },
        approvals,
        versions,
      };
    });

    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

// ---------- Decision ----------
const decisionSchema = z
  .object({
    decision: z.enum(["approve", "reject", "returnForRevision"]),
    reason: z.string().max(2000).optional().nullable(),
  })
  .strict();

approvalsRouter.post("/quotes/:id/approvals/:approvalId/decision", async (req, res, next) => {
  try {
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const quoteId = req.params.id as string;
    const approvalId = req.params.approvalId as string;
    if (!/^[0-9a-f-]{36}$/i.test(quoteId) || !/^[0-9a-f-]{36}$/i.test(approvalId))
      throw new ApiError(400, "BAD_REQUEST", "Invalid id");
    if (
      (parsed.data.decision === "reject" || parsed.data.decision === "returnForRevision") &&
      (!parsed.data.reason || parsed.data.reason.trim().length === 0)
    ) {
      throw new ApiError(400, "BAD_REQUEST", "Reason required for reject/return");
    }
    const { tenantId, actorId, requestId, role, userId } = getCtx(req);
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      if (idempotencyKey) {
        const existing = await findIdempotency(tx as any, {
          tenantId,
          actorId,
          operation: `quote.approval.decision:${approvalId}`,
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
      if (quote.status !== "awaitingApproval")
        throw new ApiError(
          422,
          "UNPROCESSABLE",
          `Quote not awaiting approval (status ${quote.status})`,
        );

      const aRows = await tx
        .select()
        .from(schema.quoteApprovals)
        .where(
          and(
            eq(schema.quoteApprovals.id, approvalId),
            eq(schema.quoteApprovals.tenantId, tenantId),
            eq(schema.quoteApprovals.quoteId, quoteId),
          ),
        )
        .limit(1);
      const approval = aRows[0];
      if (!approval) throw new ApiError(404, "NOT_FOUND", "Approval not found");
      if (approval.status !== "pending")
        throw new ApiError(409, "CONFLICT", `Approval already decided (${approval.status})`, {
          currentStatus: approval.status,
        });

      // self-approval prevention
      if (quote.ownerUserId === userId)
        throw new ApiError(403, "FORBIDDEN", "Cannot approve own quote");

      // role authorization — exact role match required
      if (approval.role !== role) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          `Role ${role} cannot decide approval requiring ${approval.role}`,
        );
      }

      // ordered pending step enforcement
      const pendingForVersion = await tx
        .select()
        .from(schema.quoteApprovals)
        .where(
          and(
            eq(schema.quoteApprovals.quoteId, quoteId),
            eq(schema.quoteApprovals.versionNumber, approval.versionNumber),
            eq(schema.quoteApprovals.status, "pending"),
          ),
        )
        .orderBy(asc(schema.quoteApprovals.sequence));
      if (pendingForVersion.length === 0)
        throw new ApiError(409, "CONFLICT", "No pending approvals for this version");
      const earliest = pendingForVersion[0]!;
      if (earliest.id !== approval.id)
        throw new ApiError(422, "UNPROCESSABLE", "Out-of-order decision: earlier step pending", {
          pendingApprovalId: earliest.id,
          pendingSequence: earliest.sequence,
        });

      // apply decision
      const now = new Date();
      let newApprovalStatus: string;
      let newQuoteStatus: string | null = null;
      if (parsed.data.decision === "approve") newApprovalStatus = "approved";
      else if (parsed.data.decision === "reject") {
        newApprovalStatus = "rejected";
        newQuoteStatus = "rejected";
      } else {
        newApprovalStatus = "returned";
        newQuoteStatus = "returnedForRevision";
      }

      const [updatedApproval] = await tx
        .update(schema.quoteApprovals)
        .set({
          status: newApprovalStatus as any,
          decision: parsed.data.decision as any,
          reason: parsed.data.reason ?? null,
          decidedBy: actorId,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.quoteApprovals.id, approvalId))
        .returning();

      if (parsed.data.decision === "approve") {
        // check if any pending left for this version
        const remaining = await tx
          .select()
          .from(schema.quoteApprovals)
          .where(
            and(
              eq(schema.quoteApprovals.quoteId, quoteId),
              eq(schema.quoteApprovals.versionNumber, approval.versionNumber),
              eq(schema.quoteApprovals.status, "pending"),
            ),
          );
        if (remaining.length === 0) {
          newQuoteStatus = "approvedInternal";
        }
      } else if (parsed.data.decision === "reject") {
        // invalidate remaining pending for this version
        await tx
          .update(schema.quoteApprovals)
          .set({
            status: "invalidated",
            decision: "invalidated",
            reason: "Rejected",
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.quoteApprovals.quoteId, quoteId),
              eq(schema.quoteApprovals.versionNumber, approval.versionNumber),
              eq(schema.quoteApprovals.status, "pending"),
            ),
          );
      } else if (parsed.data.decision === "returnForRevision") {
        await tx
          .update(schema.quoteApprovals)
          .set({
            status: "invalidated",
            decision: "invalidated",
            reason: "Returned for revision",
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.quoteApprovals.quoteId, quoteId),
              eq(schema.quoteApprovals.versionNumber, approval.versionNumber),
              eq(schema.quoteApprovals.status, "pending"),
            ),
          );
      }

      let updatedQuote: any = quote;
      if (newQuoteStatus) {
        const [uq] = await tx
          .update(schema.quotes)
          .set({ status: newQuoteStatus as any, revision: quote.revision + 1, updatedAt: now })
          .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.revision, quote.revision)))
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
      }

      await writeAuditEvent(tx as any, {
        tenantId,
        actorId,
        action: "quote.approval.decision",
        entityType: "quote_approval",
        entityId: approvalId,
        requestId,
        detail: {
          decision: parsed.data.decision,
          reason: parsed.data.reason ?? null,
          versionNumber: approval.versionNumber,
          sequence: approval.sequence,
        } as any,
      });

      await tx.insert(schema.outboxEvents).values({
        tenantId,
        aggregateType: "quote",
        aggregateId: quoteId,
        eventType: "quote.approvalDecided",
        payload: {
          quoteId,
          approvalId,
          decision: parsed.data.decision,
          versionNumber: approval.versionNumber,
          newQuoteStatus: updatedQuote.status,
        } as any,
      });
      await tx.insert(schema.outboxEvents).values({
        tenantId,
        aggregateType: "notification",
        aggregateId: quoteId,
        eventType: "notification.approvalDecided",
        payload: { quoteId, approvalId, decision: parsed.data.decision, actorId } as any,
      });

      const response = { approval: updatedApproval, quote: updatedQuote };
      if (idempotencyKey) {
        await storeIdempotency(tx as any, {
          tenantId,
          actorId,
          operation: `quote.approval.decision:${approvalId}`,
          key: idempotencyKey,
          responseStatus: "200",
          responseBody: response,
        });
      }
      return { data: response, status: 200, fromIdempotency: false };
    });

    if ((result as any).fromIdempotency)
      res.status((result as any).status).json({ data: (result as any).data });
    else res.status((result as any).status).json({ data: (result as any).data });
  } catch (e) {
    next(e);
  }
});

// ---------- Inbox ----------
approvalsRouter.get("/approvals/inbox", async (req, res, next) => {
  try {
    const { tenantId, role, userId } = getCtx(req);
    if (!["manager", "finance", "admin", "ops"].includes(role))
      throw new ApiError(403, "FORBIDDEN", "Inbox not available for role");
    const limitRaw = typeof req.query.limit === "string" ? req.query.limit : undefined;
    const limit = limitRaw ? Math.min(Math.max(Number(limitRaw), 1), 100) : 25;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const result = await withTenantTransaction({ tenantId }, async (tx) => {
      // pending approvals for caller's role
      const allPending = await tx
        .select()
        .from(schema.quoteApprovals)
        .where(
          and(
            eq(schema.quoteApprovals.tenantId, tenantId),
            eq(schema.quoteApprovals.status, "pending"),
            eq(schema.quoteApprovals.role, role),
          ),
        )
        .orderBy(desc(schema.quoteApprovals.createdAt));

      // filter ordered: only earliest pending per quote/version should be visible
      // For simplicity, check each pending is earliest pending for its version
      const filtered: any[] = [];
      for (const a of allPending) {
        const pendings = await tx
          .select()
          .from(schema.quoteApprovals)
          .where(
            and(
              eq(schema.quoteApprovals.quoteId, a.quoteId),
              eq(schema.quoteApprovals.versionNumber, a.versionNumber),
              eq(schema.quoteApprovals.status, "pending"),
            ),
          )
          .orderBy(asc(schema.quoteApprovals.sequence));
        if (pendings[0]?.id === a.id) {
          // also exclude own quotes
          const q = await tx
            .select()
            .from(schema.quotes)
            .where(eq(schema.quotes.id, a.quoteId))
            .limit(1)
            .then((r: any) => r[0]);
          if (q && q.ownerUserId !== userId) filtered.push({ approval: a, quote: q });
        }
      }

      // cursor handling simple: cursor is approval id
      let sliced = filtered;
      if (cursor) {
        const decoded = decodeCursor(cursor);
        if (decoded) {
          const idx = filtered.findIndex((f: any) => f.approval.id === decoded.id);
          if (idx >= 0) sliced = filtered.slice(idx + 1);
        }
      }
      const pageItems = sliced.slice(0, limit + 1);
      const hasMore = pageItems.length > limit;
      const items = hasMore ? pageItems.slice(0, limit) : pageItems;
      const nextCursor =
        hasMore && items.length > 0
          ? encodeCursor({
              createdAt: items[items.length - 1].approval.createdAt.toISOString(),
              id: items[items.length - 1].approval.id,
            })
          : null;
      return { data: items, page: { limit, nextCursor } };
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});

// ---------- Audit timeline ----------
approvalsRouter.get("/quotes/:id/audit-events", async (req, res, next) => {
  try {
    const quoteId = req.params.id as string;
    if (!/^[0-9a-f-]{36}$/i.test(quoteId))
      throw new ApiError(400, "BAD_REQUEST", "Invalid quote id");
    const { tenantId, role, userId } = getCtx(req);
    const parsed = paginationQuerySchema.safeParse(req.query);
    if (!parsed.success)
      throw new ApiError(400, "BAD_REQUEST", "Invalid pagination", parsed.error.flatten());
    const { limit, cursor } = parsed.data;

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
        const isApprover = ["manager", "finance"].includes(role);
        if (!isOwner && !isTeam && !isApprover)
          throw new ApiError(404, "NOT_FOUND", "Quote not found");
      }

      const decoded = cursor ? decodeCursor(cursor) : null;
      const all = await tx
        .select()
        .from(schema.auditEvents)
        .where(
          and(eq(schema.auditEvents.tenantId, tenantId), eq(schema.auditEvents.entityId, quoteId)),
        )
        .orderBy(desc(schema.auditEvents.createdAt));
      // also include audit events for quote_approval entities linked to this quote? We'll fetch approvals to include their audit events
      const approvalIds = await tx
        .select()
        .from(schema.quoteApprovals)
        .where(eq(schema.quoteApprovals.quoteId, quoteId))
        .then((r: any) => r.map((a: any) => a.id));
      const extra: any[] = [];
      if (approvalIds.length) {
        for (const aid of approvalIds) {
          const evs = await tx
            .select()
            .from(schema.auditEvents)
            .where(
              and(eq(schema.auditEvents.tenantId, tenantId), eq(schema.auditEvents.entityId, aid)),
            );
          extra.push(...evs);
        }
      }
      let combined = [...all, ...extra].sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      if (decoded) {
        const idx = combined.findIndex((r: any) => r.id === decoded.id);
        if (idx >= 0) combined = combined.slice(idx + 1);
      }
      const pageItems = combined.slice(0, limit + 1);
      const hasMore = pageItems.length > limit;
      const items = hasMore ? pageItems.slice(0, limit) : pageItems;
      const nextCursor =
        hasMore && items.length > 0
          ? encodeCursor({
              createdAt: items[items.length - 1].createdAt.toISOString(),
              id: items[items.length - 1].id,
            })
          : null;

      // redact sensitive fields (never tokens/password hashes) — already audit detail doesn't contain them
      return { data: items, page: { limit, nextCursor } };
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});
