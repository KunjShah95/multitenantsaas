import express, { type Request } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { logger } from "./shared/logger.js";
import { requestIdMiddleware } from "./shared/requestId.js";
import { errorMiddleware, notFoundHandler } from "./shared/errors.js";
import { mountHealthRoutes } from "./app/health.js";
import { getEnv } from "./config/env.js";
import { authRouter, portalRouter, meRouter } from "./api/v1/auth.routes.js";
import { configRouter } from "./api/v1/config.routes.js";
import { governanceRouter } from "./api/v1/governance.routes.js";
import { quotesRouter } from "./api/v1/quotes.routes.js";

export function createApp() {
  const env = getEnv();
  const app = express();

  // Request ID must be first so all logs/errors have it
  app.use(requestIdMiddleware);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

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

  app.use(
    cors({
      origin: (origin, cb) => {
        const allow = [env.APP_ORIGIN, env.PORTAL_ORIGIN];
        if (!origin || allow.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  // Foundation probes
  mountHealthRoutes(app);

  // v1 API — Phase 02 auth & portal identity
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/portal/auth", portalRouter);
  app.use("/api/v1/me", meRouter);

  // v1 API — Phase 03 catalog/governance (tenant-scoped configuration)
  app.use("/api/v1", configRouter);
  app.use("/api/v1", governanceRouter);

  // v1 API — Phase 04 quotes (tenant-scoped, revision-protected)
  app.use("/api/v1", quotesRouter);

  // 404 for unknown routes — single error envelope
  app.use(notFoundHandler);

  // Central error serializer — must be last
  app.use(errorMiddleware);

  return app;
}
