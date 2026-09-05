import pino from "pino";

// Path-based redaction covers all known secret/token/PII field names at any
// depth level. Never log raw credentials, hashes, or provider keys.
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
      // HTTP headers
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      // Database / infrastructure
      "*.DATABASE_URL",
      "*.DATABASE_URL_UNPOOLED",
      // Auth secrets
      "*.JWT_ACCESS_SECRET",
      "*.SESSION_PEPPER",
      "*.password",
      "*.passwordHash",
      "*.secret",
      "*.tokenHash",
      // Session / token values
      "*.accessToken",
      "*.refreshToken",
      "*.token",
      "*.sessionToken",
      // Provider keys
      "*.EMAIL_PROVIDER_API_KEY",
      "*.PAYMENT_WEBHOOK_SECRET",
      "*.OBJECT_STORAGE_ACCESS_KEY_ID",
      "*.OBJECT_STORAGE_SECRET_ACCESS_KEY",
      // PII
      "*.rawBody",
    ],
    remove: true,
  },
});
