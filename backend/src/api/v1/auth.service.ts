import { eq, and } from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import { organizations, users, memberships, sessions, invitations } from "../../db/schema/index.js";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../../auth/password.js";
import { signAccessToken } from "../../auth/tokens.js";
import { generateOpaqueToken, hashToken, getRefreshExpiry, getInvitationExpiry, getRefreshCookieOptions } from "../../auth/session.js";
import { getEmailAdapter } from "../../integrations/email/index.js";
import { ApiError } from "../../shared/errors.js";
import { writeAuditEvent } from "../../shared/audit.js";
import { getPermissionsForRole } from "../../auth/permissions.js";

type LoginInput = { email: string; password: string; organizationSlug?: string };
type BootstrapInput = { organizationName: string; slug: string; adminName: string; adminEmail: string; password: string };

export async function login(input: LoginInput, requestId?: string) {
  const db = getDb();
  const userRows = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  const user = userRows[0];
  if (!user || !user.passwordHash) throw new ApiError(401, "UNAUTHORIZED", "Invalid credentials");
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new ApiError(401, "UNAUTHORIZED", "Invalid credentials");

  // Resolve memberships
  const mems = await db.select().from(memberships).where(eq(memberships.userId, user.id));
  if (mems.length === 0) throw new ApiError(403, "FORBIDDEN", "No membership found");

  let activeMembership = mems[0]!;
  if (input.organizationSlug) {
    const orgRows = await db.select().from(organizations).where(eq(organizations.slug, input.organizationSlug)).limit(1);
    const org = orgRows[0];
    if (!org) throw new ApiError(404, "NOT_FOUND", "Organization not found");
    const found = mems.find((m) => m.tenantId === org.id);
    if (!found) throw new ApiError(403, "FORBIDDEN", "Not a member of that organization");
    activeMembership = found;
  }

  // Create session
  const rawRefresh = generateOpaqueToken();
  const tokenHash = hashToken(rawRefresh);
  const expiresAt = getRefreshExpiry();

  const [sess] = await db
    .insert(sessions)
    .values({
      tenantId: activeMembership.tenantId,
      userId: user.id,
      tokenHash,
      expiresAt,
    })
    .returning();

  const accessToken = signAccessToken({
    sub: user.id,
    sid: sess!.id,
    tid: activeMembership.tenantId,
    role: activeMembership.role,
    email: user.email,
  });

  const orgRows = await db.select().from(organizations).where(eq(organizations.id, activeMembership.tenantId)).limit(1);
  const org = orgRows[0]!;

  // Audit (best effort, use same tenant context)
  try {
    await writeAuditEvent(db as unknown as import("../../db/connection.js").Db, {
      tenantId: activeMembership.tenantId,
      actorId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      requestId: requestId ?? null,
      detail: { organizationId: org.id },
    });
  } catch {}

  return {
    accessToken,
    refreshToken: rawRefresh,
    refreshCookieOptions: getRefreshCookieOptions(),
    user: { id: user.id, email: user.email, name: user.name },
    organization: { id: org.id, name: org.name, slug: org.slug },
    membership: { id: activeMembership.id, role: activeMembership.role, tenantId: activeMembership.tenantId },
  };
}

export async function refresh(refreshToken: string, requestId?: string) {
  if (!refreshToken) throw new ApiError(401, "UNAUTHORIZED", "Missing refresh token");
  const tokenHash = hashToken(refreshToken);
  const db = getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1);
  const sess = rows[0];
  if (!sess) throw new ApiError(401, "UNAUTHORIZED", "Invalid refresh token");
  if (sess.revokedAt) throw new ApiError(401, "UNAUTHORIZED", "Session revoked");
  if (sess.expiresAt < new Date()) throw new ApiError(401, "UNAUTHORIZED", "Session expired");

  // Rotation: revoke old, create new
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sess.id));

  const memRows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, sess.userId), eq(memberships.tenantId, sess.tenantId)))
    .limit(1);
  const membership = memRows[0];
  if (!membership) throw new ApiError(401, "UNAUTHORIZED", "Membership missing");

  const userRows = await db.select().from(users).where(eq(users.id, sess.userId)).limit(1);
  const user = userRows[0]!;

  const newRaw = generateOpaqueToken();
  const newHash = hashToken(newRaw);
  const expiresAt = getRefreshExpiry();
  const [newSess] = await db
    .insert(sessions)
    .values({
      tenantId: sess.tenantId,
      userId: sess.userId,
      tokenHash: newHash,
      expiresAt,
    })
    .returning();

  const accessToken = signAccessToken({
    sub: user.id,
    sid: newSess!.id,
    tid: membership.tenantId,
    role: membership.role,
    email: user.email,
  });

  return {
    accessToken,
    refreshToken: newRaw,
    refreshCookieOptions: getRefreshCookieOptions(),
  };
}

export async function logout(refreshToken: string) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  const db = getDb();
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, tokenHash));
}

export async function getMe(userId: string, tenantId: string, sessionId: string) {
  const db = getDb();
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");

  const memRows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.tenantId, tenantId)))
    .limit(1);
  const membership = memRows[0];
  if (!membership) throw new ApiError(403, "FORBIDDEN", "No membership in active organization");

  const orgRows = await db.select().from(organizations).where(eq(organizations.id, tenantId)).limit(1);
  const org = orgRows[0]!;

  const sessRows = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  const sess = sessRows[0];
  if (!sess || sess.revokedAt || sess.expiresAt < new Date()) throw new ApiError(401, "UNAUTHORIZED", "Session invalid");

  const permissions = getPermissionsForRole(membership.role);

  return {
    user: { id: user.id, email: user.email, name: user.name },
    organization: { id: org.id, name: org.name, slug: org.slug },
    membership: { id: membership.id, role: membership.role, tenantId: membership.tenantId },
    permissions,
  };
}

export async function switchOrganization(userId: string, currentTenantId: string, targetOrgId: string) {
  const db = getDb();
  // Verify user is member of target
  const memRows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.tenantId, targetOrgId)))
    .limit(1);
  const membership = memRows[0];
  if (!membership) throw new ApiError(403, "FORBIDDEN", "Not a member of target organization");

  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0]!;

  // Create new session for new tenant? Or reuse session with new tenant context — simpler to issue new session and revoke old
  // Find current session to rotate: we need refresh token handling; caller passes via cookie, but this service is called from controller with current sessionId
  // For switch, we will create new session and new access token
  const raw = generateOpaqueToken();
  const hash = hashToken(raw);
  const expiresAt = getRefreshExpiry();
  const [sess] = await db
    .insert(sessions)
    .values({
      tenantId: targetOrgId,
      userId,
      tokenHash: hash,
      expiresAt,
    })
    .returning();

  const accessToken = signAccessToken({
    sub: userId,
    sid: sess!.id,
    tid: targetOrgId,
    role: membership.role,
    email: user.email,
  });

  const orgRows = await db.select().from(organizations).where(eq(organizations.id, targetOrgId)).limit(1);
  const org = orgRows[0]!;

  return {
    accessToken,
    refreshToken: raw,
    refreshCookieOptions: getRefreshCookieOptions(),
    organization: { id: org.id, name: org.name, slug: org.slug },
    membership: { id: membership.id, role: membership.role },
  };
}

export async function bootstrap(input: BootstrapInput) {
  const db = getDb();
  const orgCount = await db.select().from(organizations).limit(1);
  if (orgCount.length > 0) throw new ApiError(403, "FORBIDDEN", "Bootstrap not allowed after initial setup");

  const pwdErr = validatePasswordStrength(input.password);
  if (pwdErr) throw new ApiError(400, "BAD_REQUEST", pwdErr);

  const slugExists = await db.select().from(organizations).where(eq(organizations.slug, input.slug)).limit(1);
  if (slugExists.length > 0) throw new ApiError(409, "CONFLICT", "Organization slug already exists");

  const emailExists = await db.select().from(users).where(eq(users.email, input.adminEmail)).limit(1);
  if (emailExists.length > 0) throw new ApiError(409, "CONFLICT", "Email already exists");

  const hash = await hashPassword(input.password);

  const [org] = await db.insert(organizations).values({ name: input.organizationName, slug: input.slug }).returning();
  const [user] = await db.insert(users).values({ email: input.adminEmail, name: input.adminName, passwordHash: hash }).returning();
  const [membership] = await db
    .insert(memberships)
    .values({ tenantId: org!.id, userId: user!.id, role: "admin" })
    .returning();

  const raw = generateOpaqueToken();
  const tokenHash = hashToken(raw);
  const [sess] = await db
    .insert(sessions)
    .values({ tenantId: org!.id, userId: user!.id, tokenHash, expiresAt: getRefreshExpiry() })
    .returning();

  const accessToken = signAccessToken({
    sub: user!.id,
    sid: sess!.id,
    tid: org!.id,
    role: "admin",
    email: user!.email,
  });

  return {
    accessToken,
    refreshToken: raw,
    refreshCookieOptions: getRefreshCookieOptions(),
    user: { id: user!.id, email: user!.email, name: user!.name },
    organization: { id: org!.id, name: org!.name, slug: org!.slug },
    membership: { id: membership!.id, role: membership!.role },
  };
}

export async function createInvitation(actor: { userId: string; tenantId: string; role: string }, input: { email: string; role: string }, requestId?: string) {
  if (actor.role !== "admin") throw new ApiError(403, "FORBIDDEN", "Only admin can invite");
  const db = getDb();

  const raw = generateOpaqueToken(24);
  const tokenHash = hashToken(raw);
  const expiresAt = getInvitationExpiry();

  try {
    const [inv] = await db
      .insert(invitations)
      .values({
        tenantId: actor.tenantId,
        email: input.email,
        role: input.role,
        tokenHash,
        expiresAt,
        createdBy: actor.userId,
      })
      .returning();

    const orgRows = await db.select().from(organizations).where(eq(organizations.id, actor.tenantId)).limit(1);
    const org = orgRows[0];
    const adapter = getEmailAdapter();
    await adapter.send({
      to: input.email,
      subject: `Invitation to join ${org?.name ?? "DealFlow360"}`,
      text: `You have been invited as ${input.role}. Use token: ${raw} to accept. Expires in 7 days.`,
    });

    // audit
    try {
      await writeAuditEvent(db as unknown as import("../../db/connection.js").Db, {
        tenantId: actor.tenantId,
        actorId: actor.userId,
        action: "invitation.create",
        entityType: "invitation",
        entityId: inv!.id,
        requestId: requestId ?? null,
      });
    } catch {}

    return { id: inv!.id, email: inv!.email, role: inv!.role, expiresAt: inv!.expiresAt };
  } catch (e: unknown) {
    const pg = e as { code?: string; cause?: { code?: string; message?: string }; message?: string };
    const code = pg.code ?? pg.cause?.code;
    if (code === "23505") throw new ApiError(409, "CONFLICT", "Invitation already exists for this email");
    if (code === "23514") throw new ApiError(400, "BAD_REQUEST", "Invalid role");
    throw e;
  }
}

export async function acceptInvitation(input: { token: string; name: string; password: string }) {
  const tokenHash = hashToken(input.token);
  const db = getDb();
  const rows = await db.select().from(invitations).where(eq(invitations.tokenHash, tokenHash)).limit(1);
  const inv = rows[0];
  if (!inv) throw new ApiError(400, "BAD_REQUEST", "Invalid invitation token");
  if (inv.acceptedAt) throw new ApiError(409, "CONFLICT", "Invitation already accepted");
  if (inv.expiresAt < new Date()) throw new ApiError(410, "CONFLICT", "Invitation expired");

  const pwdErr = validatePasswordStrength(input.password);
  if (pwdErr) throw new ApiError(400, "BAD_REQUEST", pwdErr);

  // Upsert user by email (must match invitation email)
  const existingUsers = await db.select().from(users).where(eq(users.email, inv.email)).limit(1);
  let user = existingUsers[0];
  if (!user) {
    const hash = await hashPassword(input.password);
    const [u] = await db.insert(users).values({ email: inv.email, name: input.name, passwordHash: hash }).returning();
    user = u!;
  } else {
    // If user exists, do not overwrite password unless no passwordHash (preserve)
    if (!user.passwordHash) {
      const hash = await hashPassword(input.password);
      await db.update(users).set({ passwordHash: hash, name: input.name }).where(eq(users.id, user.id));
    }
    // verify that invitation role is used, not client-chosen
  }

  // Create membership with invitation role (cannot escalate)
  try {
    await db.insert(memberships).values({ tenantId: inv.tenantId, userId: user.id, role: inv.role });
  } catch (e: unknown) {
    const pg = e as { code?: string; cause?: { code?: string } };
    const code = pg.code ?? pg.cause?.code;
    if (code === "23505") {
      // already member — treat as conflict
      throw new ApiError(409, "CONFLICT", "Already a member of this organization");
    }
    if (code === "23514") throw new ApiError(400, "BAD_REQUEST", "Invalid role");
    throw e;
  }

  await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, inv.id));

  // Auto-login after accept — create session
  const raw = generateOpaqueToken();
  const sessHash = hashToken(raw);
  const [sess] = await db
    .insert(sessions)
    .values({ tenantId: inv.tenantId, userId: user.id, tokenHash: sessHash, expiresAt: getRefreshExpiry() })
    .returning();

  const accessToken = signAccessToken({
    sub: user.id,
    sid: sess!.id,
    tid: inv.tenantId,
    role: inv.role,
    email: user.email,
  });

  const orgRows = await db.select().from(organizations).where(eq(organizations.id, inv.tenantId)).limit(1);
  const org = orgRows[0]!;

  return {
    accessToken,
    refreshToken: raw,
    refreshCookieOptions: getRefreshCookieOptions(),
    user: { id: user.id, email: user.email, name: user.name },
    organization: { id: org.id, name: org.name, slug: org.slug },
    membership: { tenantId: inv.tenantId, role: inv.role },
  };
}
