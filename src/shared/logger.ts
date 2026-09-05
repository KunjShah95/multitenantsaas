import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.secret",
      "*.DATABASE_URL",
      "*.DATABASE_URL_UNPOOLED",
      "*.JWT_ACCESS_SECRET",
      "*.SESSION_PEPPER",
    ],
    remove: true,
  },
});
