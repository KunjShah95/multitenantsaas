import express, { type Request } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./shared/logger.js";
import { requestIdMiddleware } from "./shared/requestId.js";
import { errorMiddleware, notFoundHandler } from "./shared/errors.js";
import { mountHealthRoutes } from "./app/health.js";
import { getEnv } from "./config/env.js";

export function createApp() {
  const env = getEnv();
  const app = express();

  // Request ID must be first so all logs/errors have it
  app.use(requestIdMiddleware);

  // Structured HTTP logs (redacts secrets via logger config)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use(
    (pinoHttp as unknown as (opts: any) => any)({
      logger,
      customProps: (req: Request) => ({
        requestId: (req as unknown as { requestId: string }).requestId,
      }),
    }),
  );

  app.use(cors({ origin: [env.APP_ORIGIN, env.PORTAL_ORIGIN], credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  // Foundation probes
  mountHealthRoutes(app);

  // 404 for unknown routes — single error envelope
  app.use(notFoundHandler);

  // Central error serializer — must be last
  app.use(errorMiddleware);

  return app;
}
