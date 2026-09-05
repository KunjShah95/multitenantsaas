import { Router } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";
import { requireMembershipRole } from "../../middleware/authorize.js";
import { ApiError } from "../../shared/errors.js";
import { withTenantTransaction } from "../../db/transaction.js";
import { writeAuditEvent } from "../../shared/audit.js";
import * as schema from "../../db/schema/index.js";

export const governanceRouter = Router();
governanceRouter.use(authenticate);

function getCtx(req: import("express").Request) {
  const auth = req.auth!;
  const requestId = (req as unknown as { requestId: string }).requestId;
  return { tenantId: auth.tenantId, actorId: auth.userId, requestId };
}

function handlePgError(e: unknown): never {
  const pg = e as { code?: string; cause?: { code?: string }; message?: string };
  const code = pg.code ?? pg.cause?.code;
  if (code === "23505") throw new ApiError(409, "CONFLICT", "Duplicate value", { detail: pg.message });
  if (code === "23503") throw new ApiError(400, "BAD_REQUEST", "Reference does not exist", { detail: pg.message });
  if (code === "23514") throw new ApiError(400, "BAD_REQUEST", pg.message ?? "Check violation");
  throw e;
}

// ---------- Discount Policies ----------
const discountPolicyCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(64).optional(),
  effectiveFrom: z.string().datetime().nullable().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  tierLimits: z.array(z.object({ tierCode: z.string().min(1), ceilingPct: z.string().regex(/^\d+(\.\d{1,2})?$/) })).optional(),
  categoryLimits: z.array(z.object({ categoryCode: z.string().min(1), ceilingPct: z.string().regex(/^\d+(\.\d{1,2})?$/)} )).optional(),
});

governanceRouter.get("/discount-policies", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const rows = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.discountPolicies).where(eq(schema.discountPolicies.tenantId, tenantId)).orderBy(schema.discountPolicies.createdAt));
    // include limits
    const enriched = await withTenantTransaction({ tenantId }, async (tx) => {
      return Promise.all(rows.map(async (p) => {
        const tiers = await tx.select().from(schema.discountTierLimits).where(eq(schema.discountTierLimits.policyId, p.id));
        const cats = await tx.select().from(schema.discountCategoryLimits).where(eq(schema.discountCategoryLimits.policyId, p.id));
        return { ...p, tierLimits: tiers, categoryLimits: cats };
      }));
    });
    res.json({ data: enriched.filter((r) => r.status !== "archived") });
  } catch (e) { next(e); }
});

governanceRouter.post("/discount-policies", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = discountPolicyCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    for (const tl of parsed.data.tierLimits ?? []) {
      const c = Number(tl.ceilingPct);
      if (c < 0 || c > 100) throw new ApiError(400, "BAD_REQUEST", `Tier ceiling ${tl.tierCode} must be 0-100`);
    }
    for (const cl of parsed.data.categoryLimits ?? []) {
      const c = Number(cl.ceilingPct);
      if (c < 0 || c > 100) throw new ApiError(400, "BAD_REQUEST", `Category ceiling ${cl.categoryCode} must be 0-100`);
      // verify category exists
      const catExists = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.productCategories).where(and(eq(schema.productCategories.tenantId, tenantId), eq(schema.productCategories.code, cl.categoryCode))).limit(1).then((r) => r[0]));
      if (!catExists || catExists.archivedAt) throw new ApiError(400, "BAD_REQUEST", `Category ${cl.categoryCode} not found or archived`);
    }
    // verify tier codes exist?
    for (const tl of parsed.data.tierLimits ?? []) {
      const tier = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.customerTiers).where(and(eq(schema.customerTiers.tenantId, tenantId), eq(schema.customerTiers.code, tl.tierCode))).limit(1).then((r) => r[0]));
      if (!tier || tier.archivedAt) throw new ApiError(400, "BAD_REQUEST", `Tier ${tl.tierCode} not found or archived`);
    }
    if (parsed.data.effectiveFrom && parsed.data.effectiveTo && new Date(parsed.data.effectiveTo) <= new Date(parsed.data.effectiveFrom)) {
      throw new ApiError(400, "BAD_REQUEST", "effectiveTo must be after effectiveFrom");
    }
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      try {
        const [policy] = await tx.insert(schema.discountPolicies).values({
          tenantId,
          name: parsed.data.name,
          code: parsed.data.code ?? null,
          effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : null,
          effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
          status: "draft",
          version: 1,
        }).returning();
        if (parsed.data.tierLimits?.length) {
          await tx.insert(schema.discountTierLimits).values(parsed.data.tierLimits.map((t) => ({ tenantId, policyId: policy!.id, tierCode: t.tierCode, ceilingPct: t.ceilingPct })));
        }
        if (parsed.data.categoryLimits?.length) {
          await tx.insert(schema.discountCategoryLimits).values(parsed.data.categoryLimits.map((c) => ({ tenantId, policyId: policy!.id, categoryCode: c.categoryCode, ceilingPct: c.ceilingPct })));
        }
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "discount_policy.create", entityType: "discount_policy", entityId: policy!.id, requestId });
        return policy;
      } catch (e) { handlePgError(e); }
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

governanceRouter.get("/discount-policies/:id", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const row = await withTenantTransaction({ tenantId }, async (tx) => {
      const p = await tx.select().from(schema.discountPolicies).where(and(eq(schema.discountPolicies.id, (req.params.id as string)), eq(schema.discountPolicies.tenantId, tenantId))).limit(1).then((r) => r[0]);
      if (!p) return null;
      const tiers = await tx.select().from(schema.discountTierLimits).where(eq(schema.discountTierLimits.policyId, p.id));
      const cats = await tx.select().from(schema.discountCategoryLimits).where(eq(schema.discountCategoryLimits.policyId, p.id));
      return { ...p, tierLimits: tiers, categoryLimits: cats };
    });
    if (!row) throw new ApiError(404, "NOT_FOUND", "Policy not found");
    res.json({ data: row });
  } catch (e) { next(e); }
});

governanceRouter.patch("/discount-policies/:id", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = z.object({ name: z.string().min(1).optional(), effectiveFrom: z.string().datetime().nullable().optional(), effectiveTo: z.string().datetime().nullable().optional(), tierLimits: z.array(z.object({ tierCode: z.string().min(1), ceilingPct: z.string().regex(/^\d+(\.\d{1,2})?$/) })).optional(), categoryLimits: z.array(z.object({ categoryCode: z.string().min(1), ceilingPct: z.string().regex(/^\d+(\.\d{1,2})?$/)})).optional() }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const rows = await tx.select().from(schema.discountPolicies).where(and(eq(schema.discountPolicies.id, (req.params.id as string)), eq(schema.discountPolicies.tenantId, tenantId))).limit(1);
      const existing = rows[0];
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Policy not found");
      if (existing.status === "published") throw new ApiError(409, "CONFLICT", "Published policy cannot be mutated; create new draft version");
      if (existing.archivedAt) throw new ApiError(404, "NOT_FOUND", "Policy archived");
      // validate percentages and refs if provided
      if (parsed.data.tierLimits) {
        for (const t of parsed.data.tierLimits) {
          const c = Number(t.ceilingPct);
          if (c < 0 || c > 100) throw new ApiError(400, "BAD_REQUEST", `Tier ceiling ${t.tierCode} must be 0-100`);
          const tier = await tx.select().from(schema.customerTiers).where(and(eq(schema.customerTiers.tenantId, tenantId), eq(schema.customerTiers.code, t.tierCode))).limit(1);
          if (!tier[0] || tier[0].archivedAt) throw new ApiError(400, "BAD_REQUEST", `Tier ${t.tierCode} not found`);
        }
      }
      if (parsed.data.categoryLimits) {
        for (const cl of parsed.data.categoryLimits) {
          const c = Number(cl.ceilingPct);
          if (c < 0 || c > 100) throw new ApiError(400, "BAD_REQUEST", `Category ceiling ${cl.categoryCode} must be 0-100`);
          const cat = await tx.select().from(schema.productCategories).where(and(eq(schema.productCategories.tenantId, tenantId), eq(schema.productCategories.code, cl.categoryCode))).limit(1);
          if (!cat[0] || cat[0].archivedAt) throw new ApiError(400, "BAD_REQUEST", `Category ${cl.categoryCode} not found`);
        }
      }
      const updates: any = { updatedAt: new Date(), revision: existing.revision + 1 };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.effectiveFrom !== undefined) updates.effectiveFrom = parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : null;
      if (parsed.data.effectiveTo !== undefined) updates.effectiveTo = parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null;
      const from = updates.effectiveFrom !== undefined ? updates.effectiveFrom : existing.effectiveFrom;
      const to = updates.effectiveTo !== undefined ? updates.effectiveTo : existing.effectiveTo;
      if (from && to && new Date(to) <= new Date(from)) throw new ApiError(400, "BAD_REQUEST", "effectiveTo must be after effectiveFrom");
      const [updated] = await tx.update(schema.discountPolicies).set(updates).where(eq(schema.discountPolicies.id, (req.params.id as string))).returning();
      if (parsed.data.tierLimits !== undefined) {
        await tx.delete(schema.discountTierLimits).where(eq(schema.discountTierLimits.policyId, (req.params.id as string)));
        if (parsed.data.tierLimits.length) await tx.insert(schema.discountTierLimits).values(parsed.data.tierLimits.map((t) => ({ tenantId, policyId: (req.params.id as string), tierCode: t.tierCode, ceilingPct: t.ceilingPct })));
      }
      if (parsed.data.categoryLimits !== undefined) {
        await tx.delete(schema.discountCategoryLimits).where(eq(schema.discountCategoryLimits.policyId, (req.params.id as string)));
        if (parsed.data.categoryLimits.length) await tx.insert(schema.discountCategoryLimits).values(parsed.data.categoryLimits.map((c) => ({ tenantId, policyId: (req.params.id as string), categoryCode: c.categoryCode, ceilingPct: c.ceilingPct })));
      }
      await writeAuditEvent(tx as any, { tenantId, actorId, action: "discount_policy.update", entityType: "discount_policy", entityId: (req.params.id as string), requestId });
      return updated;
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});

governanceRouter.post("/discount-policies/:id/publish", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const rows = await tx.select().from(schema.discountPolicies).where(and(eq(schema.discountPolicies.id, (req.params.id as string)), eq(schema.discountPolicies.tenantId, tenantId))).limit(1);
      const existing = rows[0];
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Policy not found");
      if (existing.status === "published") throw new ApiError(409, "CONFLICT", "Already published");
      if (existing.archivedAt) throw new ApiError(404, "NOT_FOUND", "Policy archived");
      const tiers = await tx.select().from(schema.discountTierLimits).where(eq(schema.discountTierLimits.policyId, (req.params.id as string)));
      const cats = await tx.select().from(schema.discountCategoryLimits).where(eq(schema.discountCategoryLimits.policyId, (req.params.id as string)));
      if (tiers.length === 0 && cats.length === 0) throw new ApiError(422, "UNPROCESSABLE", "Policy must have at least one tier or category limit");
      for (const t of tiers) {
        const c = Number(t.ceilingPct);
        if (Number.isNaN(c) || c < 0 || c > 100) throw new ApiError(422, "UNPROCESSABLE", `Invalid ceiling ${t.tierCode}: ${t.ceilingPct}`);
      }
      for (const cl of cats) {
        const c = Number(cl.ceilingPct);
        if (Number.isNaN(c) || c < 0 || c > 100) throw new ApiError(422, "UNPROCESSABLE", `Invalid ceiling ${cl.categoryCode}: ${cl.ceilingPct}`);
      }
      // effective dates already validated
      const [published] = await tx.update(schema.discountPolicies).set({ status: "published", publishedAt: new Date(), updatedAt: new Date() }).where(eq(schema.discountPolicies.id, (req.params.id as string))).returning();
      await writeAuditEvent(tx as any, { tenantId, actorId, action: "discount_policy.publish", entityType: "discount_policy", entityId: (req.params.id as string), requestId });
      return published;
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});

// ---------- Approval Policies ----------
const approvalPolicyCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(64).optional(),
  effectiveFrom: z.string().datetime().nullable().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  steps: z.array(z.object({ sequence: z.number().int().min(1), role: z.enum(["manager", "finance", "admin", "ops"]), name: z.string().optional(), required: z.boolean().optional() })).min(1),
});

governanceRouter.get("/approval-policies", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const rows = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.approvalPolicies).where(eq(schema.approvalPolicies.tenantId, tenantId)).orderBy(schema.approvalPolicies.createdAt));
    const enriched = await withTenantTransaction({ tenantId }, async (tx) => Promise.all(rows.map(async (p) => {
      const steps = await tx.select().from(schema.approvalPolicySteps).where(eq(schema.approvalPolicySteps.policyId, p.id)).then((r) => r.sort((a,b)=>a.sequence-b.sequence));
      return { ...p, steps };
    })));
    res.json({ data: enriched.filter((r) => r.status !== "archived") });
  } catch (e) { next(e); }
});

governanceRouter.post("/approval-policies", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = approvalPolicyCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const seqs = parsed.data.steps.map((s) => s.sequence).sort((a,b)=>a-b);
    for (let i=0;i<seqs.length;i++) if (seqs[i] !== i+1) throw new ApiError(400, "BAD_REQUEST", "Steps must be sequential 1..n without gaps");
    if (new Set(seqs).size !== seqs.length) throw new ApiError(400, "BAD_REQUEST", "Duplicate sequence");
    if (parsed.data.effectiveFrom && parsed.data.effectiveTo && new Date(parsed.data.effectiveTo) <= new Date(parsed.data.effectiveFrom)) throw new ApiError(400, "BAD_REQUEST", "effectiveTo must be after effectiveFrom");
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      try {
        const [policy] = await tx.insert(schema.approvalPolicies).values({
          tenantId,
          name: parsed.data.name,
          code: parsed.data.code ?? null,
          effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : null,
          effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
          status: "draft",
          version: 1,
        }).returning();
        await tx.insert(schema.approvalPolicySteps).values(parsed.data.steps.map((s) => ({
          tenantId,
          policyId: policy!.id,
          sequence: s.sequence,
          role: s.role,
          name: s.name ?? null,
          required: s.required ?? true,
        })));
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "approval_policy.create", entityType: "approval_policy", entityId: policy!.id, requestId });
        return policy;
      } catch (e) { handlePgError(e); }
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

governanceRouter.get("/approval-policies/:id", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const row = await withTenantTransaction({ tenantId }, async (tx) => {
      const p = await tx.select().from(schema.approvalPolicies).where(and(eq(schema.approvalPolicies.id, (req.params.id as string)), eq(schema.approvalPolicies.tenantId, tenantId))).limit(1).then((r)=>r[0]);
      if (!p) return null;
      const steps = await tx.select().from(schema.approvalPolicySteps).where(eq(schema.approvalPolicySteps.policyId, p.id)).then((r)=>r.sort((a,b)=>a.sequence-b.sequence));
      return { ...p, steps };
    });
    if (!row) throw new ApiError(404, "NOT_FOUND", "Policy not found");
    res.json({ data: row });
  } catch (e) { next(e); }
});

governanceRouter.patch("/approval-policies/:id", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = z.object({ name: z.string().min(1).optional(), effectiveFrom: z.string().datetime().nullable().optional(), effectiveTo: z.string().datetime().nullable().optional(), steps: z.array(z.object({ sequence: z.number().int().min(1), role: z.enum(["manager","finance","admin","ops"]), name: z.string().optional(), required: z.boolean().optional() })).optional() }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const rows = await tx.select().from(schema.approvalPolicies).where(and(eq(schema.approvalPolicies.id, (req.params.id as string)), eq(schema.approvalPolicies.tenantId, tenantId))).limit(1);
      const existing = rows[0];
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Policy not found");
      if (existing.status === "published") throw new ApiError(409, "CONFLICT", "Published policy cannot be mutated; create new draft version");
      if (parsed.data.steps) {
        const seqs = parsed.data.steps.map((s)=>s.sequence).sort((a,b)=>a-b);
        for (let i=0;i<seqs.length;i++) if (seqs[i] !== i+1) throw new ApiError(400, "BAD_REQUEST", "Steps must be sequential 1..n");
      }
      const updates: any = { updatedAt: new Date(), revision: existing.revision + 1 };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.effectiveFrom !== undefined) updates.effectiveFrom = parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : null;
      if (parsed.data.effectiveTo !== undefined) updates.effectiveTo = parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null;
      const from = updates.effectiveFrom !== undefined ? updates.effectiveFrom : existing.effectiveFrom;
      const to = updates.effectiveTo !== undefined ? updates.effectiveTo : existing.effectiveTo;
      if (from && to && new Date(to) <= new Date(from)) throw new ApiError(400, "BAD_REQUEST", "effectiveTo must be after effectiveFrom");
      const [updated] = await tx.update(schema.approvalPolicies).set(updates).where(eq(schema.approvalPolicies.id, (req.params.id as string))).returning();
      if (parsed.data.steps !== undefined) {
        await tx.delete(schema.approvalPolicySteps).where(eq(schema.approvalPolicySteps.policyId, (req.params.id as string)));
        if (parsed.data.steps.length) await tx.insert(schema.approvalPolicySteps).values(parsed.data.steps.map((s)=>({ tenantId, policyId: (req.params.id as string), sequence: s.sequence, role: s.role, name: s.name ?? null, required: s.required ?? true })));
      }
      await writeAuditEvent(tx as any, { tenantId, actorId, action: "approval_policy.update", entityType: "approval_policy", entityId: (req.params.id as string), requestId });
      return updated;
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});

governanceRouter.post("/approval-policies/:id/publish", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const rows = await tx.select().from(schema.approvalPolicies).where(and(eq(schema.approvalPolicies.id, (req.params.id as string)), eq(schema.approvalPolicies.tenantId, tenantId))).limit(1);
      const existing = rows[0];
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Policy not found");
      if (existing.status === "published") throw new ApiError(409, "CONFLICT", "Already published");
      const steps = await tx.select().from(schema.approvalPolicySteps).where(eq(schema.approvalPolicySteps.policyId, (req.params.id as string)));
      if (steps.length === 0) throw new ApiError(422, "UNPROCESSABLE", "Policy must have at least one ordered step");
      const seqs = steps.map((s)=>s.sequence).sort((a,b)=>a-b);
      for (let i=0;i<seqs.length;i++) if (seqs[i] !== i+1) throw new ApiError(422, "UNPROCESSABLE", "Steps must be sequential 1..n");
      const [published] = await tx.update(schema.approvalPolicies).set({ status: "published", publishedAt: new Date(), updatedAt: new Date() }).where(eq(schema.approvalPolicies.id, (req.params.id as string))).returning();
      await writeAuditEvent(tx as any, { tenantId, actorId, action: "approval_policy.publish", entityType: "approval_policy", entityId: (req.params.id as string), requestId });
      return published;
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});
