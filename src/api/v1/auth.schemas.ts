import { z } from "zod";

export const loginSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(1).max(128),
    organizationSlug: z.string().min(1).max(64).optional(),
  })
  .strict();

export const switchOrgSchema = z
  .object({
    organizationId: z.string().uuid(),
  })
  .strict();

export const bootstrapSchema = z
  .object({
    organizationName: z.string().min(1).max(100),
    slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
    adminName: z.string().min(1).max(100),
    adminEmail: z.string().email().max(255),
    password: z.string().min(8).max(128),
  })
  .strict();

export const invitationCreateSchema = z
  .object({
    email: z.string().email().max(255),
    role: z.enum(["admin", "rep", "manager", "finance", "ops"]),
  })
  .strict();

export const invitationAcceptSchema = z
  .object({
    token: z.string().min(20).max(200),
    name: z.string().min(1).max(100),
    password: z.string().min(8).max(128),
  })
  .strict();

export const portalRequestLinkSchema = z
  .object({
    email: z.string().email().max(255),
    quoteShareToken: z.string().optional(),
  })
  .strict();

export const portalExchangeSchema = z
  .object({
    token: z.string().min(20).max(200),
  })
  .strict();

export const portalLoginSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(1).max(128),
  })
  .strict();
