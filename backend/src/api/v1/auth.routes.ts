import { Router } from "express";
import { ApiError } from "../../shared/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireMembershipRole } from "../../middleware/authorize.js";
import {
  loginSchema,
  switchOrgSchema,
  bootstrapSchema,
  invitationCreateSchema,
  invitationAcceptSchema,
  portalRequestLinkSchema,
  portalExchangeSchema,
} from "./auth.schemas.js";
import * as service from "./auth.service.js";
import { requestPortalLink, exchangePortalLink } from "../../auth/portal.js";
import { getPortalCookieOptions } from "../../auth/session.js";
import { authRateLimiter as authLimiter, portalRateLimiter as portalLimiter } from "../../shared/rateLimiter.js";

export const authRouter = Router();

function setRefreshCookie(
  res: import("express").Response,
  token: string,
  opts: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
    path: string;
    maxAge: number;
  },
) {
  res.cookie("refresh_token", token, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite as "lax",
    path: opts.path,
    maxAge: opts.maxAge,
  });
}

function clearRefreshCookie(res: import("express").Response) {
  res.clearCookie("refresh_token", { path: "/" });
}

// POST /api/v1/auth/bootstrap
authRouter.post("/bootstrap", authLimiter, async (req, res, next) => {
  try {
    const parsed = bootstrapSchema.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const result = await service.bootstrap(parsed.data);
    setRefreshCookie(res, result.refreshToken, result.refreshCookieOptions);
    res.status(201).json({
      data: {
        accessToken: result.accessToken,
        user: result.user,
        organization: result.organization,
        membership: result.membership,
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/auth/login
authRouter.post("/login", authLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const requestId = (req as unknown as { requestId: string }).requestId;
    const result = await service.login(parsed.data, requestId);
    setRefreshCookie(res, result.refreshToken, result.refreshCookieOptions);
    res.json({
      data: {
        accessToken: result.accessToken,
        user: result.user,
        organization: result.organization,
        membership: result.membership,
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/auth/refresh
authRouter.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) throw new ApiError(401, "UNAUTHORIZED", "Missing refresh token");
    const result = await service.refresh(
      token,
      (req as unknown as { requestId: string }).requestId,
    );
    setRefreshCookie(res, result.refreshToken, result.refreshCookieOptions);
    res.json({ data: { accessToken: result.accessToken } });
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/auth/logout
authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token as string | undefined;
    await service.logout(token ?? "");
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/me — mounted at /api/v1/me (not /auth/me)
export const meRouter = Router();
meRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const auth = req.auth!;
    const data = await service.getMe(auth.userId, auth.tenantId, auth.sessionId);
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/auth/switch-organization
authRouter.post("/switch-organization", authenticate, async (req, res, next) => {
  try {
    const parsed = switchOrgSchema.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const auth = req.auth!;
    const result = await service.switchOrganization(
      auth.userId,
      auth.tenantId,
      parsed.data.organizationId,
    );
    setRefreshCookie(res, result.refreshToken, result.refreshCookieOptions);
    res.json({
      data: {
        accessToken: result.accessToken,
        organization: result.organization,
        membership: result.membership,
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/auth/invitations (admin only)
authRouter.post(
  "/invitations",
  authenticate,
  requireMembershipRole("admin"),
  async (req, res, next) => {
    try {
      const parsed = invitationCreateSchema.safeParse(req.body);
      if (!parsed.success)
        throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
      const auth = req.auth!;
      const requestId = (req as unknown as { requestId: string }).requestId;
      const inv = await service.createInvitation(
        { userId: auth.userId, tenantId: auth.tenantId, role: auth.role },
        parsed.data,
        requestId,
      );
      res.status(201).json({ data: inv });
    } catch (e) {
      next(e);
    }
  },
);

// POST /api/v1/auth/invitations/accept (public)
authRouter.post("/invitations/accept", authLimiter, async (req, res, next) => {
  try {
    const parsed = invitationAcceptSchema.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const result = await service.acceptInvitation(parsed.data);
    setRefreshCookie(res, result.refreshToken, result.refreshCookieOptions);
    res.status(201).json({
      data: {
        accessToken: result.accessToken,
        user: result.user,
        organization: result.organization,
        membership: result.membership,
      },
    });
  } catch (e) {
    next(e);
  }
});

// Portal routes under same router but prefixed /portal/auth — mount separately below
export const portalRouter = Router();

// POST /api/v1/portal/auth/request-link
portalRouter.post("/request-link", portalLimiter, async (req, res, next) => {
  try {
    const parsed = portalRequestLinkSchema.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    await requestPortalLink(parsed.data.email);
    // Neutral 202 regardless of existence
    res.status(202).json({ data: { message: "If an account exists, a link has been sent" } });
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/portal/auth/exchange-link
portalRouter.post("/exchange-link", portalLimiter, async (req, res, next) => {
  try {
    const parsed = portalExchangeSchema.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    const result = await exchangePortalLink(parsed.data.token);
    const cookieOpts = getPortalCookieOptions();
    res.cookie("portal_token", result.portalToken, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: "/",
      maxAge: cookieOpts.maxAge,
    });
    res.json({ data: { tenantId: result.tenantId, contactId: result.contactId } });
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/portal/auth/login — stub: contacts have no password yet, return neutral error without leaking existence
portalRouter.post("/login", portalLimiter, async (req, res, next) => {
  try {
    // Validate shape but always return 401 without revealing existence
    const { portalLoginSchema } = await import("./auth.schemas.js");
    const parsed = portalLoginSchema.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(400, "BAD_REQUEST", "Invalid input", parsed.error.flatten());
    throw new ApiError(401, "UNAUTHORIZED", "Invalid credentials — use magic link");
  } catch (e) {
    next(e);
  }
});
