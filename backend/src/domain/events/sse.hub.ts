import type { Response } from "express";
import { and, eq, gt, desc } from "drizzle-orm";
import type { Db } from "../../db/connection.js";
import { outboxEvents } from "../../db/schema/index.js";

export interface SseEventPayload {
  eventId: string;
  type: string;
  entityId: string;
  revision?: number;
  occurredAt: string;
}

export class SseHub {
  private static clients: Map<string, Set<Response>> = new Map();
  private static keepAliveTimer: NodeJS.Timeout | null = null;

  static init() {
    if (!this.keepAliveTimer) {
      this.keepAliveTimer = setInterval(() => {
        for (const [tenantId, clientSet] of this.clients.entries()) {
          for (const res of clientSet) {
            try {
              res.write(": keepalive\n\n");
            } catch {
              clientSet.delete(res);
            }
          }
          if (clientSet.size === 0) {
            this.clients.delete(tenantId);
          }
        }
      }, 20000);
      // Ensure timer doesn't keep node process alive
      if (this.keepAliveTimer.unref) {
        this.keepAliveTimer.unref();
      }
    }
  }

  static register(tenantId: string, res: Response) {
    this.init();
    if (!this.clients.has(tenantId)) {
      this.clients.set(tenantId, new Set());
    }
    this.clients.get(tenantId)!.add(res);

    res.on("close", () => {
      const set = this.clients.get(tenantId);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          this.clients.delete(tenantId);
        }
      }
    });
  }

  /**
   * Broadcasts a minimal event to all active SSE subscribers of a tenant.
   * Payload never includes internal raw records or PII.
   */
  static broadcast(tenantId: string, event: SseEventPayload) {
    const clientSet = this.clients.get(tenantId);
    if (!clientSet || clientSet.size === 0) return;

    const data = JSON.stringify(event);
    const message = `id: ${event.eventId}\nevent: ${event.type}\ndata: ${data}\n\n`;

    for (const res of clientSet) {
      try {
        res.write(message);
      } catch {
        clientSet.delete(res);
      }
    }
  }

  /**
   * Replays missed events for a tenant if Last-Event-ID is provided.
   * Bounded to a maximum of 50 events.
   */
  static async replayMissedEvents(
    tx: Db,
    tenantId: string,
    lastEventId?: string,
    res?: Response,
  ): Promise<number> {
    if (!lastEventId || !res) return 0;

    // Find reference event
    const [refEvent] = await tx
      .select({ createdAt: outboxEvents.createdAt })
      .from(outboxEvents)
      .where(and(eq(outboxEvents.tenantId, tenantId), eq(outboxEvents.id, lastEventId)))
      .limit(1);

    if (!refEvent) return 0;

    const missed = await tx
      .select()
      .from(outboxEvents)
      .where(
        and(eq(outboxEvents.tenantId, tenantId), gt(outboxEvents.createdAt, refEvent.createdAt)),
      )
      .orderBy(desc(outboxEvents.createdAt))
      .limit(50);

    // Replay in chronological order
    missed.reverse();
    for (const evt of missed) {
      const payload: SseEventPayload = {
        eventId: evt.id,
        type: evt.eventType,
        entityId: evt.aggregateId,
        occurredAt: evt.createdAt.toISOString(),
      };
      res.write(`id: ${evt.id}\nevent: ${evt.eventType}\ndata: ${JSON.stringify(payload)}\n\n`);
    }

    return missed.length;
  }
}
