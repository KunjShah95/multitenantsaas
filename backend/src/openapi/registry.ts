import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

/**
 * Central OpenAPI registry for DealFlow360 v1 API.
 *
 * Registers Zod schemas and paths to generate an OpenAPI 3.1 document.
 * The document is served at GET /api/v1/openapi.json (unauthenticated, read-only).
 *
 * See docs/FRONTEND_API.md for the authoritative readable API guide.
 * See docs/02-technology-decisions.md for the rationale for this approach.
 */
export const registry = new OpenAPIRegistry();

// ── Common reusable schemas ──────────────────────────────────────────────────

export const ErrorEnvelopeSchema = registry.register(
  "ErrorEnvelope",
  z.object({
    error: z.object({
      code: z.string().openapi({ example: "UNAUTHORIZED" }),
      message: z.string().openapi({ example: "Missing authentication token" }),
      requestId: z.string().openapi({ example: "req_abc123" }),
      details: z.unknown().optional(),
    }),
  }),
);

export const PaginationSchema = registry.register(
  "PaginationMeta",
  z.object({
    limit: z.number().int().min(1).max(100).openapi({ example: 20 }),
    nextCursor: z.string().nullable().openapi({ example: null }),
  }),
);

// ── Auth schemas ─────────────────────────────────────────────────────────────

export const LoginRequestSchema = registry.register(
  "LoginRequest",
  z.object({
    email: z.string().email().openapi({ example: "alice@acme.test" }),
    password: z.string().openapi({ example: "••••••••" }),
    organizationSlug: z.string().optional().openapi({ example: "acme" }),
  }),
);

export const LoginResponseSchema = registry.register(
  "LoginResponse",
  z.object({
    data: z.object({
      accessToken: z.string().openapi({ description: "Short-lived JWT. Store in memory only." }),
      user: z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        name: z.string().nullable(),
      }),
      organization: z.object({
        id: z.string().uuid(),
        slug: z.string(),
        name: z.string(),
      }),
      membership: z.object({
        id: z.string().uuid(),
        role: z.enum(["admin", "rep", "manager", "finance", "ops"]),
      }),
    }),
  }),
);

// ── Health schemas ───────────────────────────────────────────────────────────

export const HealthzResponseSchema = registry.register(
  "HealthzResponse",
  z.object({
    status: z.literal("ok"),
    app: z.string().openapi({ example: "DealFlow360" }),
    time: z.string().datetime().openapi({ example: "2026-09-05T12:00:00.000Z" }),
  }),
);

export const ReadyzResponseSchema = registry.register(
  "ReadyzResponse",
  z.object({
    status: z.enum(["ok", "degraded"]),
    db: z.enum(["ok", "error"]),
    time: z.string().datetime(),
  }),
);

// ── Register paths ───────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/healthz",
  summary: "Liveness probe",
  tags: ["Health"],
  security: [],
  responses: {
    200: {
      description: "Application is alive",
      content: {
        "application/json": { schema: HealthzResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/readyz",
  summary: "Readiness probe — checks DB connectivity",
  tags: ["Health"],
  security: [],
  responses: {
    200: { description: "Ready", content: { "application/json": { schema: ReadyzResponseSchema } } },
    503: { description: "Not ready (DB unreachable)", content: { "application/json": { schema: ReadyzResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/login",
  summary: "Internal user login",
  tags: ["Auth"],
  security: [],
  request: {
    body: { content: { "application/json": { schema: LoginRequestSchema } }, required: true },
  },
  responses: {
    200: {
      description: "Login successful — refresh_token set as HttpOnly cookie",
      content: { "application/json": { schema: LoginResponseSchema } },
    },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
    401: { description: "Invalid credentials", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
    429: { description: "Rate limited", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/refresh",
  summary: "Rotate access token using refresh cookie",
  tags: ["Auth"],
  security: [],
  responses: {
    200: {
      description: "New access token issued",
      content: {
        "application/json": {
          schema: z.object({ data: z.object({ accessToken: z.string() }) }),
        },
      },
    },
    401: { description: "Invalid or expired refresh token", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/logout",
  summary: "Logout — clears refresh cookie and revokes session",
  tags: ["Auth"],
  security: [],
  responses: {
    204: { description: "Logged out" },
  },
});
registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Short-lived access token from POST /api/v1/auth/login. Store in memory only.",
});

registry.registerPath({
  method: "get",
  path: "/api/v1/me",
  summary: "Get current user context — call on boot",
  tags: ["Auth"],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Current user, organization, membership, and permissions",
      content: { "application/json": { schema: z.object({ data: z.record(z.string(), z.unknown()) }) } },
    },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  },
});

// ── Document generator ────────────────────────────────────────────────────────

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "DealFlow360 API",
      version: "1.0.0",
      description:
        "DealFlow360 multi-tenant B2B deal flow management API. " +
        "See docs/FRONTEND_API.md for the complete frontend integration guide.",
    },
    servers: [{ url: "/", description: "Current host" }],
    security: [],
  });
}
