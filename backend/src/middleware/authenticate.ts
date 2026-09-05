import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../shared/errors.js";
import { verifyAccessToken, type AccessTokenPayload } from "../auth/tokens.js";
import { getDb } from "../db/connection.js";
import { eq, and } from "drizzle-orm";
import { sessions, memberships } from "../db/schema/index.js";

export type AuthContext = {
  userId: string;
  sessionId: string;
  tenantId: string;
  role: string;
  email: string;
  membershipId?: string;
};

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
    portalAuth?: { contactId: string; tenantId: string; sessionId: string };
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new ApiError(401, "UNAUTHORIZED", "Missing authentication token");
    }
    const token = header.slice(7).trim();
    if (!token) throw new ApiError(401, "UNAUTHORIZED", "Missing authentication token");

    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token");
    }

    // Verify session still valid (not revoked, not expired)
    const db = getDb();
    const rows = await db.select().from(sessions).where(eq(sessions.id, payload.sid)).limit(1);
    const sess = rows[0];
    if (!sess || sess.revokedAt || sess.expiresAt < new Date() || sess.tokenHash == null) {
      throw new ApiError(401, "UNAUTHORIZED", "Session expired or revoked");
    }
    if (sess.userId !== payload.sub || sess.tenantId !== payload.tid) {
      throw new ApiError(401, "UNAUTHORIZED", "Session mismatch");
    }

    // Verify membership still exists for tenant context (optional but ensures tenant switch)
    const memRows = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, payload.sub), eq(memberships.tenantId, payload.tid)))
      .limit(1);
    // Allow admin bootstrap? If no membership, still allow but set role from token; tenant membership check is later via requireMembershipRole
    const membershipId = memRows[0]?.id;

    req.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      tenantId: payload.tid,
      role: payload.role,
      email: payload.email,
      membershipId,
    };
    // For downstream RLS
    (req as unknown as { tenantId: string }).tenantId = payload.tid;
    next();
  } catch (err) {
    next(err);
  }
}

// Optional authenticate for portal (cookie-based, also accepts Authorization Bearer for tests)
export async function authenticatePortal(req: Request, _res: Response, next: NextFunction) {
  try {
    const cookieToken = (req as unknown as { cookies?: Record<string, string> }).cookies
      ?.portal_token;
    const header = req.headers.authorization;
    const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    // also allow x-portal-token header for test convenience
    const headerPortal = req.headers["x-portal-token"] as string | undefined;
    const token = cookieToken ?? bearer ?? headerPortal;
    if (!token) throw new ApiError(401, "UNAUTHORIZED", "Missing portal session");
    const { verifyPortalToken } = await import("../auth/portal.js");
    const ctx = await verifyPortalToken(token);
    req.portalAuth = ctx;
    (req as unknown as { tenantId: string }).tenantId = ctx.tenantId;
    next();
  } catch (err) {
    next(err);
  }
}
