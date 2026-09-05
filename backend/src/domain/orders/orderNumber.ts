/**
 * Human order and shipment number generators
 */
export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padStart(6, "0");
  const seq = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `ORD-${year}-${rand}${seq}`.slice(0, 32);
}

export function generateShipmentNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padStart(6, "0");
  const seq = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `SHP-${year}-${rand}${seq}`.slice(0, 32);
}
