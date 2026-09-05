import { z } from "zod";
import dotenv from "dotenv";

// Load .env in non-production without overriding already-set vars
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const placeholderPattern = /change-me|example\.com|password@ep-example/i;

const optionalUrl = z
  .string()
  .trim()
  .min(1)
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const requiredInProduction = (field: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .superRefine((val, ctx) => {
      if (process.env.NODE_ENV === "production") {
        if (!val || placeholderPattern.test(val) || val.length < 16) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field} is required in production and must be a high-entropy value (not placeholder). Generate with: openssl rand -base64 48`,
          });
        }
      }
    });

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  // Phase 1+ — optional until Neon integration; required in production
  DATABASE_URL: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .superRefine((val, ctx) => {
      if (process.env.NODE_ENV === "production" && !val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "DATABASE_URL is required in production",
        });
      }
      if (val && !val.startsWith("postgresql://") && !val.startsWith("postgres://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "DATABASE_URL must be a postgres connection string",
        });
      }
    }),
  DATABASE_URL_UNPOOLED: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .superRefine((val, ctx) => {
      if (val && !val.startsWith("postgresql://") && !val.startsWith("postgres://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "DATABASE_URL_UNPOOLED must be a postgres connection string",
        });
      }
    }),

  JWT_ACCESS_SECRET: requiredInProduction("JWT_ACCESS_SECRET"),
  SESSION_PEPPER: requiredInProduction("SESSION_PEPPER"),

  APP_ORIGIN: z.string().trim().url().default("http://localhost:5173"),
  PORTAL_ORIGIN: z.string().trim().url().default("http://localhost:5173"),

  // Deferred — all optional
  EMAIL_PROVIDER_API_KEY: optionalUrl,
  EMAIL_FROM: optionalUrl,
  OBJECT_STORAGE_ENDPOINT: optionalUrl,
  OBJECT_STORAGE_BUCKET: optionalUrl,
  OBJECT_STORAGE_ACCESS_KEY_ID: optionalUrl,
  OBJECT_STORAGE_SECRET_ACCESS_KEY: optionalUrl,
  OBJECT_STORAGE_REGION: optionalUrl,
  PAYMENT_PROVIDER: optionalUrl,
  PAYMENT_WEBHOOK_SECRET: optionalUrl,
  ERROR_TRACKING_DSN: optionalUrl,
});

export type Env = z.infer<typeof baseSchema>;

let cached: Env | null = null;

export function parseEnv(overrides: Record<string, string | undefined> = process.env): Env {
  const result = baseSchema.safeParse(overrides);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    const message = `Environment validation failed:\n${formatted}\n\nCheck .env.example and docs/00-owner-setup.md. In production all required secrets must be set; in development missing Neon values are tolerated until Phase 1.`;
    throw new Error(message);
  }

  // In non-production, warn (not throw) if Phase 1 values are missing so legacy demo still starts
  if (result.data.NODE_ENV !== "production") {
    const missing: string[] = [];
    if (!result.data.DATABASE_URL)
      missing.push("DATABASE_URL (Neon pooled) — deferred until Phase 1");
    if (!result.data.DATABASE_URL_UNPOOLED)
      missing.push("DATABASE_URL_UNPOOLED (Neon direct) — deferred until Phase 1");
    if (!result.data.JWT_ACCESS_SECRET)
      missing.push("JWT_ACCESS_SECRET — will use insecure dev fallback until Phase 2");
    if (!result.data.SESSION_PEPPER)
      missing.push("SESSION_PEPPER — will use insecure dev fallback until Phase 2");
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[env] missing optional (Phase 0 tolerates):\n  - ${missing.join("\n  - ")}`);
    }
  }

  return result.data;
}

export function getEnv(): Env {
  if (cached) return cached;
  cached = parseEnv();
  return cached;
}

// For tests: allow resetting cache
export function __resetEnvCache() {
  cached = null;
}
