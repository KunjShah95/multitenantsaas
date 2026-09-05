import type { Db } from "../db/connection.js";
import { auditEvents } from "../db/schema/index.js";

export type AuditInput = {
  tenantId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: Record<string, unknown> | null;
  requestId?: string | null;
};

/**
 * Transactional audit write — must be called with the same tx as business mutation.
 * Caller must already be inside withTenantTransaction.
 */
export async function writeAuditEvent(
  tx: Db,
  input: AuditInput,
): Promise<void> {
  // Db type is union of Pool DB and transaction; insert is available on both
  await (tx as unknown as Db).insert(auditEvents).values({
    tenantId: input.tenantId,
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    detail: input.detail ?? null,
    requestId: input.requestId ?? null,
  });
}
