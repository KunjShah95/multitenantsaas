export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padStart(6, "0");
  const seq = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `INV-${year}-${rand}${seq}`.slice(0, 32);
}
