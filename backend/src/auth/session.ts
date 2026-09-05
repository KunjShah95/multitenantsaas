import { randomBytes, createHmac } from "node:crypto";
import { getEnv } from "../config/env.js";

export const REFRESH_TOKEN_BYTES = 32;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getPepper(): string {
  const env = getEnv();
  const pepper = env.SESSION_PEPPER;
  if (!pepper) throw new Error("SESSION_PEPPER is not set");
  return pepper;
}

/**
 * Generate opaque refresh token (base64url, 43 chars)
 */
export function generateOpaqueToken(bytes = REFRESH_TOKEN_BYTES): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Hash token with HMAC-SHA256 using SESSION_PEPPER — stored in DB.
 * Raw token never persisted.
 */
export function hashToken(raw: string): string {
  const pepper = getPepper();
  return createHmac("sha256", pepper).update(raw).digest("hex");
}

export function getRefreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TTL_MS);
}

export function getInvitationExpiry(): Date {
  return new Date(Date.now() + INVITATION_TTL_MS);
}

export function getMagicLinkExpiry(): Date {
  return new Date(Date.now() + MAGIC_LINK_TTL_MS);
}

export type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
};

export function getRefreshCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TTL_MS,
  };
}

export function getPortalCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TTL_MS,
  };
}
