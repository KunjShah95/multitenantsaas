import rateLimit, { type Options } from "express-rate-limit";

/**
 * Creates a rate limiter with consistent settings:
 * - Returns error envelope matching docs/03-backend-architecture.md
 * - Sets `Retry-After` header on 429 responses so clients can back off
 * - Uses `standardHeaders: "draft-7"` for RateLimit-* headers (RFC 9110)
 */
export function createRateLimiter(opts: Partial<Options> & { windowMs: number; max: number }) {
  return rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    ...opts,
    handler: (req, res) => {
      const requestId =
        (req as unknown as { requestId?: string }).requestId ?? "req_unknown";
      const retryAfter = Math.ceil(opts.windowMs / 1000);
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: opts.message ?? "Too many requests. Please try again later.",
          requestId,
        },
      });
    },
  });
}

// ── Pre-built limiters (used across auth, portal, and public routes) ────────

/** Strict limiter for login / password-reset / magic-link endpoints */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: "Too many authentication attempts. Please try again in 15 minutes.",
});

/** General API limiter for authenticated endpoints */
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: "Request rate exceeded. Please slow down.",
});

/** Public / portal endpoints limiter */
export const portalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many portal requests. Please try again later.",
});
