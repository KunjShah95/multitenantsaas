import { getEnv } from "../../config/env.js";

export type BillingCapabilities = {
  automaticCollectionEnabled: boolean;
  recurringBillingAutomatic: boolean;
  paymentProvider: string | null;
};

/**
 * Automatic collection requires both a configured provider sandbox and a worker deployment.
 * Phase 8 ships manual/demo payment only unless owner prerequisites are met.
 */
export function getBillingCapabilities(): BillingCapabilities {
  const env = getEnv();
  const hasProvider = Boolean(env.PAYMENT_PROVIDER && env.PAYMENT_WEBHOOK_SECRET);
  // pg-boss / worker not introduced in this phase — automatic billing deferred
  const hasWorker = false;
  const automatic = hasProvider && hasWorker;
  return {
    automaticCollectionEnabled: automatic,
    recurringBillingAutomatic: automatic,
    paymentProvider: env.PAYMENT_PROVIDER ?? null,
  };
}
