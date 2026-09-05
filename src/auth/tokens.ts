import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string; // userId
  sid: string; // sessionId
  tid: string; // tenantId (active organization)
  role: string;
  email: string;
  // standard claims
  iat?: number;
  exp?: number;
};

const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes

function getSecret(): string {
  const env = getEnv();
  const secret = env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not set");
  }
  if (secret.length < 16) throw new Error("JWT_ACCESS_SECRET too short");
  return secret;
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "iat" | "exp">): string {
  const secret = getSecret();
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: ACCESS_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = getSecret();
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as AccessTokenPayload;
  if (!decoded.sub || !decoded.sid || !decoded.tid || !decoded.role) {
    throw new Error("Invalid token payload");
  }
  return decoded;
}

export function decodeWithoutVerify(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.decode(token) as AccessTokenPayload | null;
    return decoded;
  } catch {
    return null;
  }
}
