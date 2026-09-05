import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../shared/errors.js";
import { getPermissionsForRole } from "../auth/permissions.js";

export function requireMembershipRole(...allowed: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = req.auth;
    if (!auth) return next(new ApiError(401, "UNAUTHORIZED", "Not authenticated"));
    if (!allowed.includes(auth.role)) {
      return next(new ApiError(403, "FORBIDDEN", `Role ${auth.role} is not allowed`));
    }
    next();
  };
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = req.auth;
    if (!auth) return next(new ApiError(401, "UNAUTHORIZED", "Not authenticated"));
    const perms = getPermissionsForRole(auth.role);
    // admin has org:manage which implies all
    if (perms.includes(permission) || perms.includes("org:manage")) return next();
    return next(new ApiError(403, "FORBIDDEN", "Insufficient permission"));
  };
}

// Ownership/team check placeholder — future phases will expand
export function requireOwnershipOrTeamAccess(getOwnerId: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = req.auth;
    if (!auth) return next(new ApiError(401, "UNAUTHORIZED", "Not authenticated"));
    if (auth.role === "admin") return next();
    const ownerId = getOwnerId(req);
    if (ownerId && ownerId === auth.userId) return next();
    return next(new ApiError(403, "FORBIDDEN", "Not owner or team member"));
  };
}
