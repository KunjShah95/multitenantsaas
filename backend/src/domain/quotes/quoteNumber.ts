/**
 * Human quote number generator: Q-YYYY-XXXXXX
 * Uniqueness is enforced by DB unique index (tenant_id, number) with retry on conflict.
 */
export function generateQuoteNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padStart(6, "0");
  const seq = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `Q-${year}-${rand}${seq}`.slice(0, 32);
}
