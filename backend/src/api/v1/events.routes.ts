import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { withTenantTransaction } from "../../db/transaction.js";
import { SseHub } from "../../domain/events/sse.hub.js";

export const eventsRouter = Router();
eventsRouter.use(authenticate);

// GET /events (Tenant-scoped SSE)
eventsRouter.get("/events", async (req, res, next) => {
  try {
    const auth = req.auth!;
    const tenantId = auth.tenantId;

    // SSE Headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Handshake
    res.write(`: connected\n\n`);

    // Handle replay if Last-Event-ID or lastEventId query param present
    const lastEventId =
      (req.headers["last-event-id"] as string | undefined) ||
      (req.query.lastEventId as string | undefined);

    if (lastEventId) {
      await withTenantTransaction({ tenantId }, async (tx) =>
        SseHub.replayMissedEvents(tx, tenantId, lastEventId, res),
      );
    }

    // Register subscriber in Hub
    SseHub.register(tenantId, res);
  } catch (err) {
    return next(err);
  }
});
