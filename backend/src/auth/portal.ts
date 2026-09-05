import { eq } from "drizzle-orm";
import { getDb } from "../db/connection.js";
import { portalMagicLinks, portalSessions, customerContacts } from "../db/schema/index.js";
import { generateOpaqueToken, hashToken, getMagicLinkExpiry, getRefreshExpiry } from "./session.js";
import { getEmailAdapter } from "../integrations/email/index.js";
import { ApiError } from "../shared/errors.js";

export async function requestPortalLink(email: string): Promise<void> {
  const db = getDb();
  // Find contact by email (any tenant — but we need tenant to store link)
  const contacts = await db
    .select()
    .from(customerContacts)
    .where(eq(customerContacts.email, email))
    .limit(10);
  // Neutral response: always 202 even if not found. Only create link if found.
  if (contacts.length === 0) return;

  for (const contact of contacts) {
    const raw = generateOpaqueToken(32);
    const tokenHash = hashToken(raw);
    const expiresAt = getMagicLinkExpiry();

    await db.insert(portalMagicLinks).values({
      tenantId: contact.tenantId,
      contactId: contact.id,
      tokenHash,
      expiresAt,
    });

    const adapter = getEmailAdapter();
    // Do not include token in logs as error, but for console adapter we need to send link
    const link = `portal-link:${raw}`; // In real app this would be https://portal.example.com/magic?token=raw
    await adapter.send({
      to: contact.email,
      subject: "Your DealFlow360 magic link",
      text: `Use this link to sign in (single-use, 15 min): ${link}`,
      html: `<p>Use this link to sign in (single-use, 15 min): ${link}</p>`,
    });
  }
}

export async function exchangePortalLink(
  rawToken: string,
): Promise<{ tenantId: string; contactId: string; portalToken: string }> {
  const tokenHash = hashToken(rawToken);
  const db = getDb();
  const rows = await db
    .select()
    .from(portalMagicLinks)
    .where(eq(portalMagicLinks.tokenHash, tokenHash))
    .limit(1);
  const link = rows[0];
  if (!link) throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired link");
  if (link.usedAt) throw new ApiError(401, "UNAUTHORIZED", "Link already used");
  if (link.expiresAt < new Date()) throw new ApiError(401, "UNAUTHORIZED", "Link expired");

  // Mark used
  await db
    .update(portalMagicLinks)
    .set({ usedAt: new Date() })
    .where(eq(portalMagicLinks.id, link.id));

  // Create portal session
  const portalRaw = generateOpaqueToken(32);
  const portalHash = hashToken(portalRaw);
  const expiresAt = getRefreshExpiry();
  const [sess] = await db
    .insert(portalSessions)
    .values({
      tenantId: link.tenantId,
      contactId: link.contactId,
      tokenHash: portalHash,
      expiresAt,
    })
    .returning();

  return { tenantId: link.tenantId, contactId: link.contactId, portalToken: portalRaw };
}

export async function verifyPortalToken(
  raw: string,
): Promise<{ contactId: string; tenantId: string; sessionId: string }> {
  const hash = hashToken(raw);
  const db = getDb();
  const rows = await db
    .select()
    .from(portalSessions)
    .where(eq(portalSessions.tokenHash, hash))
    .limit(1);
  const sess = rows[0];
  if (!sess || sess.revokedAt || sess.expiresAt < new Date())
    throw new ApiError(401, "UNAUTHORIZED", "Portal session expired");
  return { contactId: sess.contactId, tenantId: sess.tenantId, sessionId: sess.id };
}

export async function revokePortalSession(raw: string): Promise<void> {
  const hash = hashToken(raw);
  const db = getDb();
  await db
    .update(portalSessions)
    .set({ revokedAt: new Date() })
    .where(eq(portalSessions.tokenHash, hash));
}
