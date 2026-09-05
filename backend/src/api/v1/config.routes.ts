import { Router } from "express";
import { z } from "zod";
import { eq, and, isNull, asc, desc, sql, like, or, ne } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";
import { requireMembershipRole } from "../../middleware/authorize.js";
import { ApiError } from "../../shared/errors.js";
import { withTenantTransaction } from "../../db/transaction.js";
import { writeAuditEvent } from "../../shared/audit.js";
import { paginationQuerySchema, encodeCursor, decodeCursor } from "../../shared/pagination.js";
import * as schema from "../../db/schema/index.js";
import { resolvePrice } from "../../domain/catalog/priceResolver.js";

export const configRouter = Router();

// All config routes require authentication; mutations require admin
configRouter.use(authenticate);

// Helper: get tenant context
function getCtx(req: import("express").Request) {
  const auth = req.auth!;
  const requestId = (req as unknown as { requestId: string }).requestId;
  return { tenantId: auth.tenantId, actorId: auth.userId, requestId, role: auth.role };
}

// Helper: map pg unique violation to 409
function handlePgError(e: unknown): never {
  const pg = e as { code?: string; cause?: { code?: string }; message?: string; constraint?: string };
  const code = pg.code ?? pg.cause?.code;
  if (code === "23505") throw new ApiError(409, "CONFLICT", "Duplicate value violates unique constraint", { detail: pg.message });
  if (code === "23503") throw new ApiError(400, "BAD_REQUEST", "Referenced entity does not exist", { detail: pg.message });
  if (code === "23514") throw new ApiError(400, "BAD_REQUEST", pg.message ?? "Check constraint violation", { detail: pg.message });
  throw e;
}

// Generic pagination helper for list queries
function parsePagination(req: import("express").Request) {
  const parsed = paginationQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid pagination", parsed.error.flatten());
  return parsed.data;
}

// ---------- Customers ----------
const customerCreateSchema = z.object({
  name: z.string().min(1).max(255),
  reference: z.string().optional(),
  tierCode: z.string().min(1).max(64).optional(),
  currency: z.string().length(3).optional(),
});
const customerPatchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  reference: z.string().nullable().optional(),
  tierCode: z.string().min(1).max(64).nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
});

configRouter.get("/customers", async (req, res, next) => {
  try {
    const { limit, cursor } = parsePagination(req);
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const tier = typeof req.query.tier === "string" ? req.query.tier : undefined;
    const { tenantId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId }, async (tx) => {
      const decoded = cursor ? decodeCursor(cursor) : null;
      // Drizzle doesn't support dynamic where easily without sql; fetch and filter in memory for simplicity (small dataset)
      const rows = await tx.select().from(schema.customers).where(eq(schema.customers.tenantId, tenantId)).orderBy(asc(schema.customers.createdAt));
      let filtered = rows.filter((r) => !r.archivedAt);
      if (q) filtered = filtered.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
      if (tier) filtered = filtered.filter((r) => r.tierCode === tier);
      if (decoded) {
        const idx = filtered.findIndex((r) => r.id === decoded.id);
        if (idx >= 0) filtered = filtered.slice(idx + 1);
      }
      const pageItems = filtered.slice(0, limit + 1);
      const hasMore = pageItems.length > limit;
      const items = hasMore ? pageItems.slice(0, limit) : pageItems;
      const nextCursor = hasMore && items.length > 0 ? encodeCursor({ createdAt: items[items.length - 1]!.createdAt.toISOString(), id: items[items.length - 1]!.id }) : null;
      return { data: items, page: { limit, nextCursor } };
    });
    res.json(result);
  } catch (e) { next(e); }
});

configRouter.post("/customers", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = customerCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      try {
        const [row] = await tx.insert(schema.customers).values({
          tenantId,
          name: parsed.data.name,
          reference: parsed.data.reference ?? null,
          tierCode: parsed.data.tierCode ?? null,
          currency: parsed.data.currency ? parsed.data.currency.toUpperCase() : null,
        }).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "customer.create", entityType: "customer", entityId: row!.id, requestId });
        return row;
      } catch (e) { handlePgError(e); }
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

configRouter.get("/customers/:id", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const row = await withTenantTransaction({ tenantId }, async (tx) => {
      const rows = await tx.select().from(schema.customers).where(and(eq(schema.customers.id, (req.params.id as string)), eq(schema.customers.tenantId, tenantId))).limit(1);
      return rows[0];
    });
    if (!row || row.archivedAt) throw new ApiError(404, "NOT_FOUND", "Customer not found");
    res.json({ data: row });
  } catch (e) { next(e); }
});

configRouter.patch("/customers/:id", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = customerPatchSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const rows = await tx.select().from(schema.customers).where(and(eq(schema.customers.id, (req.params.id as string)), eq(schema.customers.tenantId, tenantId))).limit(1);
      const existing = rows[0];
      if (!existing || existing.archivedAt) throw new ApiError(404, "NOT_FOUND", "Customer not found");
      if (existing.archivedAt) throw new ApiError(400, "BAD_REQUEST", "Cannot mutate archived customer");
      const updates: any = { updatedAt: new Date() };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.reference !== undefined) updates.reference = parsed.data.reference;
      if (parsed.data.tierCode !== undefined) updates.tierCode = parsed.data.tierCode;
      if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency ? parsed.data.currency.toUpperCase() : null;
      try {
        const [updated] = await tx.update(schema.customers).set(updates).where(eq(schema.customers.id, (req.params.id as string))).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "customer.update", entityType: "customer", entityId: (req.params.id as string), requestId });
        return updated;
      } catch (e) { handlePgError(e); }
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});

// Archive via PATCH with archivedAt or DELETE sets archivedAt
configRouter.delete("/customers/:id", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const { tenantId, actorId, requestId } = getCtx(req);
    await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const rows = await tx.select().from(schema.customers).where(and(eq(schema.customers.id, (req.params.id as string)), eq(schema.customers.tenantId, tenantId))).limit(1);
      if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Customer not found");
      if (rows[0].archivedAt) throw new ApiError(409, "CONFLICT", "Already archived");
      await tx.update(schema.customers).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(schema.customers.id, (req.params.id as string)));
      await writeAuditEvent(tx as any, { tenantId, actorId, action: "customer.archive", entityType: "customer", entityId: (req.params.id as string), requestId });
    });
    res.status(204).send();
  } catch (e) { next(e); }
});

// Customer contacts
const contactCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

configRouter.get("/customers/:id/contacts", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const contacts = await withTenantTransaction({ tenantId }, async (tx) => {
      return tx.select().from(schema.customerContacts).where(and(eq(schema.customerContacts.customerId, (req.params.id as string)), eq(schema.customerContacts.tenantId, tenantId))).orderBy(asc(schema.customerContacts.createdAt));
    });
    res.json({ data: contacts });
  } catch (e) { next(e); }
});

configRouter.post("/customers/:id/contacts", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = contactCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const cust = await tx.select().from(schema.customers).where(and(eq(schema.customers.id, (req.params.id as string)), eq(schema.customers.tenantId, tenantId))).limit(1);
      if (!cust[0] || cust[0].archivedAt) throw new ApiError(404, "NOT_FOUND", "Customer not found");
      try {
        const [row] = await tx.insert(schema.customerContacts).values({
          tenantId,
          customerId: (req.params.id as string),
          name: parsed.data.name,
          email: parsed.data.email.toLowerCase(),
        }).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "customer_contact.create", entityType: "customer_contact", entityId: row!.id, requestId });
        return row;
      } catch (e) { handlePgError(e); }
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

// ---------- Customer Tiers ----------
const tierCreateSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1),
  priority: z.number().int().optional(),
});

configRouter.get("/customer-tiers", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const rows = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.customerTiers).where(eq(schema.customerTiers.tenantId, tenantId)).orderBy(asc(schema.customerTiers.code)));
    const active = rows.filter((r) => !r.archivedAt);
    res.json({ data: active });
  } catch (e) { next(e); }
});

configRouter.post("/customer-tiers", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = tierCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      try {
        const [row] = await tx.insert(schema.customerTiers).values({ tenantId, code: parsed.data.code, name: parsed.data.name, priority: parsed.data.priority ?? 0 }).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "customer_tier.create", entityType: "customer_tier", entityId: row!.id, requestId });
        return row;
      } catch (e) { handlePgError(e); }
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

// ---------- Product Categories ----------
const categoryCreateSchema = z.object({ code: z.string().min(1).max(64), name: z.string().min(1) });

configRouter.get("/product-categories", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const rows = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.productCategories).where(eq(schema.productCategories.tenantId, tenantId)).orderBy(asc(schema.productCategories.code)));
    res.json({ data: rows.filter((r) => !r.archivedAt) });
  } catch (e) { next(e); }
});

configRouter.post("/product-categories", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = categoryCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      try {
        const [row] = await tx.insert(schema.productCategories).values({ tenantId, code: parsed.data.code, name: parsed.data.name }).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "product_category.create", entityType: "product_category", entityId: row!.id, requestId });
        return row;
      } catch (e) { handlePgError(e); }
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

// ---------- Products ----------
const productCreateSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1),
  categoryId: z.string().uuid().optional().nullable(),
  unit: z.string().min(1).max(32).optional(),
  standardPrice: z.string().regex(/^\d+(\.\d{1,6})?$/),
  standardCost: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
  taxRatePct: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});
const productPatchSchema = z.object({
  name: z.string().min(1).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  sku: z.string().min(1).max(64).optional(),
  unit: z.string().min(1).max(32).optional(),
  standardPrice: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
  standardCost: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
  taxRatePct: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

configRouter.get("/products", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const rows = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.products).where(eq(schema.products.tenantId, tenantId)).orderBy(asc(schema.products.name)));
    res.json({ data: rows.filter((r) => !r.archivedAt) });
  } catch (e) { next(e); }
});

configRouter.post("/products", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = productCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      if (parsed.data.categoryId) {
        const cat = await tx.select().from(schema.productCategories).where(and(eq(schema.productCategories.id, parsed.data.categoryId), eq(schema.productCategories.tenantId, tenantId))).limit(1);
        if (!cat[0] || cat[0].archivedAt) throw new ApiError(400, "BAD_REQUEST", "Category not found or archived");
      }
      const tax = parsed.data.taxRatePct ? Number(parsed.data.taxRatePct) : 0;
      if (tax < 0 || tax > 100) throw new ApiError(400, "BAD_REQUEST", "taxRatePct must be 0-100");
      try {
        const [row] = await tx.insert(schema.products).values({
          tenantId,
          sku: parsed.data.sku,
          name: parsed.data.name,
          categoryId: parsed.data.categoryId ?? null,
          unit: parsed.data.unit ?? "ea",
          standardPrice: parsed.data.standardPrice,
          standardCost: parsed.data.standardCost ?? "0",
          taxRatePct: parsed.data.taxRatePct ?? "0",
        }).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "product.create", entityType: "product", entityId: row!.id, requestId });
        return row;
      } catch (e) { handlePgError(e); }
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

configRouter.get("/products/:id", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const row = await withTenantTransaction({ tenantId }, async (tx) => {
      const rows = await tx.select().from(schema.products).where(and(eq(schema.products.id, (req.params.id as string)), eq(schema.products.tenantId, tenantId))).limit(1);
      return rows[0];
    });
    if (!row || row.archivedAt) throw new ApiError(404, "NOT_FOUND", "Product not found");
    res.json({ data: row });
  } catch (e) { next(e); }
});

configRouter.patch("/products/:id", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = productPatchSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const rows = await tx.select().from(schema.products).where(and(eq(schema.products.id, (req.params.id as string)), eq(schema.products.tenantId, tenantId))).limit(1);
      const existing = rows[0];
      if (!existing || existing.archivedAt) throw new ApiError(404, "NOT_FOUND", "Product not found");
      if (parsed.data.categoryId !== undefined) {
        if (parsed.data.categoryId) {
          const cat = await tx.select().from(schema.productCategories).where(and(eq(schema.productCategories.id, parsed.data.categoryId), eq(schema.productCategories.tenantId, tenantId))).limit(1);
          if (!cat[0] || cat[0].archivedAt) throw new ApiError(400, "BAD_REQUEST", "Category not found or archived");
        }
      }
      if (parsed.data.taxRatePct !== undefined) {
        const t = Number(parsed.data.taxRatePct);
        if (t < 0 || t > 100) throw new ApiError(400, "BAD_REQUEST", "taxRatePct must be 0-100");
      }
      const updates: any = { updatedAt: new Date(), revision: existing.revision + 1 };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.sku !== undefined) updates.sku = parsed.data.sku;
      if (parsed.data.categoryId !== undefined) updates.categoryId = parsed.data.categoryId;
      if (parsed.data.unit !== undefined) updates.unit = parsed.data.unit;
      if (parsed.data.standardPrice !== undefined) updates.standardPrice = parsed.data.standardPrice;
      if (parsed.data.standardCost !== undefined) updates.standardCost = parsed.data.standardCost;
      if (parsed.data.taxRatePct !== undefined) updates.taxRatePct = parsed.data.taxRatePct;
      try {
        const [updated] = await tx.update(schema.products).set(updates).where(eq(schema.products.id, (req.params.id as string))).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "product.update", entityType: "product", entityId: (req.params.id as string), requestId });
        return updated;
      } catch (e) { handlePgError(e); }
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});

// ---------- Product Variants ----------
const variantCreateSchema = z.object({
  attribute: z.string().min(1),
  value: z.string().min(1),
  sku: z.string().min(1).max(64).optional(),
  extraPrice: z.string().regex(/^-?\d+(\.\d{1,6})?$/).optional(),
});

configRouter.post("/products/:id/variants", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = variantCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const prod = await tx.select().from(schema.products).where(and(eq(schema.products.id, (req.params.id as string)), eq(schema.products.tenantId, tenantId))).limit(1);
      if (!prod[0] || prod[0].archivedAt) throw new ApiError(404, "NOT_FOUND", "Product not found or archived");
      try {
        const [row] = await tx.insert(schema.productVariants).values({
          tenantId,
          productId: (req.params.id as string),
          attribute: parsed.data.attribute,
          value: parsed.data.value,
          sku: parsed.data.sku ?? null,
          extraPrice: parsed.data.extraPrice ?? "0",
        }).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "product_variant.create", entityType: "product_variant", entityId: row!.id, requestId });
        return row;
      } catch (e) { handlePgError(e); }
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

configRouter.patch("/products/:id/variants/:variantId", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const schemaPatch = z.object({ attribute: z.string().min(1).optional(), value: z.string().min(1).optional(), sku: z.string().min(1).max(64).nullable().optional(), extraPrice: z.string().regex(/^-?\d+(\.\d{1,6})?$/).optional() });
    const parsed = schemaPatch.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const rows = await tx.select().from(schema.productVariants).where(and(eq(schema.productVariants.id, (req.params.variantId as string)), eq(schema.productVariants.tenantId, tenantId), eq(schema.productVariants.productId, (req.params.id as string)))).limit(1);
      if (!rows[0] || rows[0].archivedAt) throw new ApiError(404, "NOT_FOUND", "Variant not found");
      const updates: any = { updatedAt: new Date() };
      if (parsed.data.attribute !== undefined) updates.attribute = parsed.data.attribute;
      if (parsed.data.value !== undefined) updates.value = parsed.data.value;
      if (parsed.data.sku !== undefined) updates.sku = parsed.data.sku;
      if (parsed.data.extraPrice !== undefined) updates.extraPrice = parsed.data.extraPrice;
      try {
        const [updated] = await tx.update(schema.productVariants).set(updates).where(eq(schema.productVariants.id, (req.params.variantId as string))).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "product_variant.update", entityType: "product_variant", entityId: (req.params.variantId as string), requestId });
        return updated;
      } catch (e) { handlePgError(e); }
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});

// ---------- Price Lists ----------
const priceListCreateSchema = z.object({
  name: z.string().min(1),
  currency: z.string().length(3),
  customerTierId: z.string().uuid().nullable().optional(),
  priority: z.number().int().optional(),
  effectiveFrom: z.string().datetime().nullable().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
});

configRouter.get("/price-lists", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const rows = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.priceLists).where(eq(schema.priceLists.tenantId, tenantId)).orderBy(desc(schema.priceLists.priority)));
    res.json({ data: rows.filter((r) => !r.archivedAt) });
  } catch (e) { next(e); }
});

configRouter.post("/price-lists", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = priceListCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    if (parsed.data.effectiveFrom && parsed.data.effectiveTo && new Date(parsed.data.effectiveTo) <= new Date(parsed.data.effectiveFrom)) {
      throw new ApiError(400, "BAD_REQUEST", "effectiveTo must be after effectiveFrom");
    }
    if (parsed.data.customerTierId) {
      const t = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.customerTiers).where(and(eq(schema.customerTiers.id, parsed.data.customerTierId!), eq(schema.customerTiers.tenantId, tenantId))).limit(1).then((r) => r[0]));
      if (!t || t.archivedAt) throw new ApiError(400, "BAD_REQUEST", "Customer tier not found or archived");
    }
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const [row] = await tx.insert(schema.priceLists).values({
        tenantId,
        name: parsed.data.name,
        currency: parsed.data.currency.toUpperCase(),
        customerTierId: parsed.data.customerTierId ?? null,
        priority: parsed.data.priority ?? 0,
        effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : null,
        effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
      }).returning();
      await writeAuditEvent(tx as any, { tenantId, actorId, action: "price_list.create", entityType: "price_list", entityId: row!.id, requestId });
      return row;
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

configRouter.get("/price-lists/:id", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const row = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.priceLists).where(and(eq(schema.priceLists.id, (req.params.id as string)), eq(schema.priceLists.tenantId, tenantId))).limit(1).then((r) => r[0]));
    if (!row || row.archivedAt) throw new ApiError(404, "NOT_FOUND", "Price list not found");
    res.json({ data: row });
  } catch (e) { next(e); }
});

configRouter.patch("/price-lists/:id", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = priceListCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const rows = await tx.select().from(schema.priceLists).where(and(eq(schema.priceLists.id, (req.params.id as string)), eq(schema.priceLists.tenantId, tenantId))).limit(1);
      if (!rows[0] || rows[0].archivedAt) throw new ApiError(404, "NOT_FOUND", "Price list not found");
      const updates: any = { updatedAt: new Date() };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency.toUpperCase();
      if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
      if (parsed.data.customerTierId !== undefined) {
        if (parsed.data.customerTierId) {
          const t = await tx.select().from(schema.customerTiers).where(and(eq(schema.customerTiers.id, parsed.data.customerTierId), eq(schema.customerTiers.tenantId, tenantId))).limit(1);
          if (!t[0] || t[0].archivedAt) throw new ApiError(400, "BAD_REQUEST", "Tier not found or archived");
        }
        updates.customerTierId = parsed.data.customerTierId;
      }
      if (parsed.data.effectiveFrom !== undefined) updates.effectiveFrom = parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : null;
      if (parsed.data.effectiveTo !== undefined) updates.effectiveTo = parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null;
      const from = updates.effectiveFrom !== undefined ? updates.effectiveFrom : rows[0].effectiveFrom;
      const to = updates.effectiveTo !== undefined ? updates.effectiveTo : rows[0].effectiveTo;
      if (from && to && new Date(to) <= new Date(from)) throw new ApiError(400, "BAD_REQUEST", "effectiveTo must be after effectiveFrom");
      const [updated] = await tx.update(schema.priceLists).set(updates).where(eq(schema.priceLists.id, (req.params.id as string))).returning();
      await writeAuditEvent(tx as any, { tenantId, actorId, action: "price_list.update", entityType: "price_list", entityId: (req.params.id as string), requestId });
      return updated;
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});

// Bulk replace items
const priceListItemsSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullable().optional(),
    price: z.string().regex(/^\d+(\.\d{1,6})?$/),
  })).min(1),
});

configRouter.put("/price-lists/:id/items", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = priceListItemsSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const list = await tx.select().from(schema.priceLists).where(and(eq(schema.priceLists.id, (req.params.id as string)), eq(schema.priceLists.tenantId, tenantId))).limit(1);
      if (!list[0] || list[0].archivedAt) throw new ApiError(404, "NOT_FOUND", "Price list not found");
      // Validate all products/variants exist and belong to tenant
      for (const it of parsed.data.items) {
        const prod = await tx.select().from(schema.products).where(and(eq(schema.products.id, it.productId), eq(schema.products.tenantId, tenantId))).limit(1);
        if (!prod[0] || prod[0].archivedAt) throw new ApiError(400, "BAD_REQUEST", `Product ${it.productId} not found or archived`);
        if (it.variantId) {
          const v = await tx.select().from(schema.productVariants).where(and(eq(schema.productVariants.id, it.variantId), eq(schema.productVariants.tenantId, tenantId), eq(schema.productVariants.productId, it.productId))).limit(1);
          if (!v[0] || v[0].archivedAt) throw new ApiError(400, "BAD_REQUEST", `Variant ${it.variantId} not found`);
        }
      }
      // Check priority/date overlap: within same tenant/currency/tier you cannot have two lists with same priority and overlapping effective window that both contain items for same product/variant — but simpler: just ensure no exact duplicate items in payload
      const seen = new Set<string>();
      for (const it of parsed.data.items) {
        const key = `${it.productId}:${it.variantId ?? "null"}`;
        if (seen.has(key)) throw new ApiError(400, "BAD_REQUEST", `Duplicate product/variant ${key} in payload`);
        seen.add(key);
      }
      // Atomic replace
      await tx.delete(schema.priceListItems).where(eq(schema.priceListItems.priceListId, (req.params.id as string)));
      const inserted = await tx.insert(schema.priceListItems).values(parsed.data.items.map((it) => ({
        tenantId,
        priceListId: (req.params.id as string),
        productId: it.productId,
        variantId: it.variantId ?? null,
        price: it.price,
      }))).returning();
      await writeAuditEvent(tx as any, { tenantId, actorId, action: "price_list.items.replace", entityType: "price_list", entityId: (req.params.id as string), requestId, detail: { count: inserted.length } });
      return inserted;
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});

// Price resolver endpoint (for testing/contract)
configRouter.post("/price-resolve", async (req, res, next) => {
  try {
    const schemaResolve = z.object({
      productId: z.string().uuid(),
      variantId: z.string().uuid().nullable().optional(),
      currency: z.string().length(3),
      customerTierId: z.string().uuid().nullable().optional(),
      effectiveDate: z.string().datetime().optional(),
    });
    const parsed = schemaResolve.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId }, async (tx) => {
      const resolved = await resolvePrice({
        tenantId,
        productId: parsed.data.productId,
        variantId: parsed.data.variantId ?? null,
        currency: parsed.data.currency,
        customerTierId: parsed.data.customerTierId ?? null,
        effectiveDate: parsed.data.effectiveDate ? new Date(parsed.data.effectiveDate) : new Date(),
        tx: tx as any,
      });
      if (!resolved) {
        // fallback to standard price
        const prod = await tx.select().from(schema.products).where(and(eq(schema.products.id, parsed.data.productId), eq(schema.products.tenantId, tenantId))).limit(1);
        if (!prod[0]) throw new ApiError(404, "NOT_FOUND", "Product not found");
        return { price: prod[0].standardPrice, source: "standard" as const };
      }
      return resolved;
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});

// ---------- Warehouses ----------
const warehouseCreateSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1),
  location: z.string().optional(),
  shippingCostWeight: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
});

configRouter.get("/warehouses", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const rows = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.warehouses).where(eq(schema.warehouses.tenantId, tenantId)).orderBy(asc(schema.warehouses.code)));
    res.json({ data: rows.filter((r) => !r.archivedAt) });
  } catch (e) { next(e); }
});

configRouter.post("/warehouses", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = warehouseCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      try {
        const [row] = await tx.insert(schema.warehouses).values({
          tenantId,
          code: parsed.data.code,
          name: parsed.data.name,
          location: parsed.data.location ?? null,
          shippingCostWeight: parsed.data.shippingCostWeight ?? "1",
        }).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "warehouse.create", entityType: "warehouse", entityId: row!.id, requestId });
        return row;
      } catch (e) { handlePgError(e); }
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

configRouter.get("/warehouses/:id", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const row = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.warehouses).where(and(eq(schema.warehouses.id, (req.params.id as string)), eq(schema.warehouses.tenantId, tenantId))).limit(1).then((r) => r[0]));
    if (!row || row.archivedAt) throw new ApiError(404, "NOT_FOUND", "Warehouse not found");
    res.json({ data: row });
  } catch (e) { next(e); }
});

configRouter.patch("/warehouses/:id", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = warehouseCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const rows = await tx.select().from(schema.warehouses).where(and(eq(schema.warehouses.id, (req.params.id as string)), eq(schema.warehouses.tenantId, tenantId))).limit(1);
      if (!rows[0] || rows[0].archivedAt) throw new ApiError(404, "NOT_FOUND", "Warehouse not found");
      const updates: any = { updatedAt: new Date() };
      if (parsed.data.code !== undefined) updates.code = parsed.data.code;
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.location !== undefined) updates.location = parsed.data.location;
      if (parsed.data.shippingCostWeight !== undefined) updates.shippingCostWeight = parsed.data.shippingCostWeight;
      try {
        const [updated] = await tx.update(schema.warehouses).set(updates).where(eq(schema.warehouses.id, (req.params.id as string))).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "warehouse.update", entityType: "warehouse", entityId: (req.params.id as string), requestId });
        return updated;
      } catch (e) { handlePgError(e); }
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});

// ---------- Inventory ----------
configRouter.get("/inventory/balances", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const warehouseId = typeof req.query.warehouseId === "string" ? req.query.warehouseId : undefined;
    const rows = await withTenantTransaction({ tenantId }, async (tx) => {
      if (warehouseId) return tx.select().from(schema.inventoryBalances).where(and(eq(schema.inventoryBalances.tenantId, tenantId), eq(schema.inventoryBalances.warehouseId, warehouseId)));
      return tx.select().from(schema.inventoryBalances).where(eq(schema.inventoryBalances.tenantId, tenantId));
    });
    const enriched = rows.map((r) => ({ ...r, available: (Number(r.onHandQty) - Number(r.reservedQty) - Number(r.allocatedQty)).toFixed(6) }));
    res.json({ data: enriched });
  } catch (e) { next(e); }
});

configRouter.get("/inventory/movements", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const rows = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.inventoryMovements).where(eq(schema.inventoryMovements.tenantId, tenantId)).orderBy(desc(schema.inventoryMovements.createdAt)).limit(50));
    res.json({ data: rows });
  } catch (e) { next(e); }
});

const adjustmentSchema = z.object({
  warehouseId: z.string().uuid(),
  sku: z.string().min(1),
  deltaQty: z.string().regex(/^-?\d+(\.\d{1,6})?$/),
  reason: z.string().min(1),
});

configRouter.post("/inventory/adjustments", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = adjustmentSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    if (Number(parsed.data.deltaQty) === 0) throw new ApiError(400, "BAD_REQUEST", "deltaQty cannot be zero");
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const wh = await tx.select().from(schema.warehouses).where(and(eq(schema.warehouses.id, parsed.data.warehouseId), eq(schema.warehouses.tenantId, tenantId))).limit(1);
      if (!wh[0] || wh[0].archivedAt) throw new ApiError(400, "BAD_REQUEST", "Warehouse not found or archived");
      // Upsert balance
      const existing = await tx.select().from(schema.inventoryBalances).where(and(eq(schema.inventoryBalances.tenantId, tenantId), eq(schema.inventoryBalances.warehouseId, parsed.data.warehouseId), eq(schema.inventoryBalances.sku, parsed.data.sku))).limit(1);
      const delta = Number(parsed.data.deltaQty);
      let balance;
      if (existing[0]) {
        const newOnHand = Number(existing[0].onHandQty) + delta;
        if (newOnHand < 0) throw new ApiError(422, "UNPROCESSABLE", "Insufficient on-hand quantity");
        const [updated] = await tx.update(schema.inventoryBalances).set({ onHandQty: newOnHand.toFixed(6), updatedAt: new Date(), revision: existing[0].revision + 1 }).where(eq(schema.inventoryBalances.id, existing[0].id)).returning();
        balance = updated;
      } else {
        if (delta < 0) throw new ApiError(422, "UNPROCESSABLE", "Cannot create negative opening balance");
        const [created] = await tx.insert(schema.inventoryBalances).values({ tenantId, warehouseId: parsed.data.warehouseId, sku: parsed.data.sku, onHandQty: delta.toFixed(6) }).returning();
        balance = created;
      }
      const [movement] = await tx.insert(schema.inventoryMovements).values({ tenantId, warehouseId: parsed.data.warehouseId, sku: parsed.data.sku, deltaQty: delta.toFixed(6), reason: parsed.data.reason }).returning();
      await writeAuditEvent(tx as any, { tenantId, actorId, action: "inventory.adjust", entityType: "inventory_balance", entityId: balance!.id, requestId, detail: { sku: parsed.data.sku, deltaQty: parsed.data.deltaQty, reason: parsed.data.reason } });
      return { balance, movement };
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

// ---------- Subscription Plans ----------
const planCreateSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1),
  billingInterval: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  price: z.string().regex(/^\d+(\.\d{1,6})?$/),
  currency: z.string().length(3).optional(),
});

configRouter.get("/subscription-plans", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const rows = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.tenantId, tenantId)).orderBy(asc(schema.subscriptionPlans.code)));
    res.json({ data: rows.filter((r) => !r.archivedAt) });
  } catch (e) { next(e); }
});

configRouter.post("/subscription-plans", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = planCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      try {
        const [row] = await tx.insert(schema.subscriptionPlans).values({
          tenantId,
          code: parsed.data.code,
          name: parsed.data.name,
          billingInterval: parsed.data.billingInterval ?? "monthly",
          price: parsed.data.price,
          currency: (parsed.data.currency ?? "USD").toUpperCase(),
        }).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "subscription_plan.create", entityType: "subscription_plan", entityId: row!.id, requestId });
        return row;
      } catch (e) { handlePgError(e); }
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

configRouter.patch("/subscription-plans/:id", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = z.object({ name: z.string().min(1).optional(), price: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(), billingInterval: z.enum(["monthly", "quarterly", "yearly"]).optional(), currency: z.string().length(3).optional() }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const rows = await tx.select().from(schema.subscriptionPlans).where(and(eq(schema.subscriptionPlans.id, (req.params.id as string)), eq(schema.subscriptionPlans.tenantId, tenantId))).limit(1);
      if (!rows[0] || rows[0].archivedAt) throw new ApiError(404, "NOT_FOUND", "Plan not found");
      const updates: any = { updatedAt: new Date() };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.price !== undefined) updates.price = parsed.data.price;
      if (parsed.data.billingInterval !== undefined) updates.billingInterval = parsed.data.billingInterval;
      if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency.toUpperCase();
      try {
        const [updated] = await tx.update(schema.subscriptionPlans).set(updates).where(eq(schema.subscriptionPlans.id, (req.params.id as string))).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "subscription_plan.update", entityType: "subscription_plan", entityId: (req.params.id as string), requestId });
        return updated;
      } catch (e) { handlePgError(e); }
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});

// ---------- Upsell Rules ----------
const upsellCreateSchema = z.object({
  triggerProductId: z.string().uuid(),
  suggestedProductId: z.string().uuid(),
  weight: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  promoted: z.boolean().optional(),
  minMarginPct: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
});

configRouter.get("/upsell-rules", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const rows = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.upsellRules).where(eq(schema.upsellRules.tenantId, tenantId)).orderBy(desc(schema.upsellRules.weight)));
    res.json({ data: rows.filter((r) => !r.archivedAt) });
  } catch (e) { next(e); }
});

configRouter.post("/upsell-rules", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = upsellCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    if (parsed.data.triggerProductId === parsed.data.suggestedProductId) throw new ApiError(400, "BAD_REQUEST", "Trigger and suggested must differ");
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      for (const pid of [parsed.data.triggerProductId, parsed.data.suggestedProductId]) {
        const p = await tx.select().from(schema.products).where(and(eq(schema.products.id, pid), eq(schema.products.tenantId, tenantId))).limit(1);
        if (!p[0] || p[0].archivedAt) throw new ApiError(400, "BAD_REQUEST", `Product ${pid} not found or archived`);
      }
      if (parsed.data.minMarginPct) {
        const m = Number(parsed.data.minMarginPct);
        if (m < 0 || m > 100) throw new ApiError(400, "BAD_REQUEST", "minMarginPct must be 0-100");
      }
      try {
        const [row] = await tx.insert(schema.upsellRules).values({
          tenantId,
          triggerProductId: parsed.data.triggerProductId,
          suggestedProductId: parsed.data.suggestedProductId,
          weight: parsed.data.weight ?? "1",
          promoted: parsed.data.promoted ?? false,
          minMarginPct: parsed.data.minMarginPct ?? null,
        }).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "upsell_rule.create", entityType: "upsell_rule", entityId: row!.id, requestId });
        return row;
      } catch (e) { handlePgError(e); }
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

configRouter.patch("/upsell-rules/:id", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = z.object({ weight: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(), promoted: z.boolean().optional(), minMarginPct: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional() }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const rows = await tx.select().from(schema.upsellRules).where(and(eq(schema.upsellRules.id, (req.params.id as string)), eq(schema.upsellRules.tenantId, tenantId))).limit(1);
      if (!rows[0] || rows[0].archivedAt) throw new ApiError(404, "NOT_FOUND", "Rule not found");
      const updates: any = { updatedAt: new Date() };
      if (parsed.data.weight !== undefined) updates.weight = parsed.data.weight;
      if (parsed.data.promoted !== undefined) updates.promoted = parsed.data.promoted;
      if (parsed.data.minMarginPct !== undefined) updates.minMarginPct = parsed.data.minMarginPct;
      const [updated] = await tx.update(schema.upsellRules).set(updates).where(eq(schema.upsellRules.id, (req.params.id as string))).returning();
      await writeAuditEvent(tx as any, { tenantId, actorId, action: "upsell_rule.update", entityType: "upsell_rule", entityId: (req.params.id as string), requestId });
      return updated;
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});

// ---------- Teams (minimal for config phase) ----------
configRouter.get("/teams", async (req, res, next) => {
  try {
    const { tenantId } = getCtx(req);
    const rows = await withTenantTransaction({ tenantId }, async (tx) => tx.select().from(schema.teams).where(eq(schema.teams.tenantId, tenantId)).orderBy(asc(schema.teams.name)));
    res.json({ data: rows });
  } catch (e) { next(e); }
});

configRouter.post("/teams", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      try {
        const [row] = await tx.insert(schema.teams).values({ tenantId, name: parsed.data.name }).returning();
        await writeAuditEvent(tx as any, { tenantId, actorId, action: "team.create", entityType: "team", entityId: row!.id, requestId });
        return row;
      } catch (e) { handlePgError(e); }
    });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

configRouter.patch("/teams/:id", requireMembershipRole("admin"), async (req, res, next) => {
  try {
    const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const { tenantId, actorId, requestId } = getCtx(req);
    const result = await withTenantTransaction({ tenantId, actorId, requestId }, async (tx) => {
      const rows = await tx.select().from(schema.teams).where(and(eq(schema.teams.id, (req.params.id as string)), eq(schema.teams.tenantId, tenantId))).limit(1);
      if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Team not found");
      const [updated] = await tx.update(schema.teams).set({ name: parsed.data.name, updatedAt: new Date() }).where(eq(schema.teams.id, (req.params.id as string))).returning();
      await writeAuditEvent(tx as any, { tenantId, actorId, action: "team.update", entityType: "team", entityId: (req.params.id as string), requestId });
      return updated;
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});
