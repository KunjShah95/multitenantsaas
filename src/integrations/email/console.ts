import type { EmailAdapter, EmailPayload } from "./types.js";
import { logger } from "../../shared/logger.js";

export class ConsoleEmailAdapter implements EmailAdapter {
  async send(payload: EmailPayload): Promise<void> {
    // Never log raw token in production logs as separate field — just neutral console
    // For dev, log to console (pino) without exposing token as credential
    logger.info({ to: payload.to, subject: payload.subject }, "[email:console] sending email");
    // eslint-disable-next-line no-console
    console.log(`[email:console] to=${payload.to} subject="${payload.subject}" text=${payload.text.slice(0, 200)}`);
  }
}
