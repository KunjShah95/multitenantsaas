import type { EmailAdapter } from "./types.js";
import { ConsoleEmailAdapter } from "./console.js";

let adapter: EmailAdapter | null = null;

export function getEmailAdapter(): EmailAdapter {
  if (adapter) return adapter;
  // Phase 02: only console adapter. Future phase wires Resend when EMAIL_PROVIDER_API_KEY is set.
  adapter = new ConsoleEmailAdapter();
  return adapter;
}

// For tests
export function __setEmailAdapter(a: EmailAdapter | null) {
  adapter = a;
}
