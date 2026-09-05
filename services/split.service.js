// Auto-split: allocate each order line across warehouses to minimize shipments,
// preferring lower shippingCostWeight and higher available stock.
// warehouses: [{id,name,shippingCostWeight,stock:{productId:qty}}]
// lines: [{productId, qty}]
// Returns {allocations:[{warehouseId,warehouseName,productId,qty}], backorder:[...], shipments, estCost}
export function autoSplit(lines, warehouses) {
  const sorted = [...warehouses].sort(
    (a, b) => (a.shippingCostWeight - b.shippingCostWeight)
  );
  const avail = {};
  for (const w of sorted) avail[w.id] = { ...(w.stock || {}) };
  const allocations = [];
  const backorder = [];
  const usedWarehouses = new Set();
  for (const l of lines) {
    let need = l.qty;
    for (const w of sorted) {
      if (need <= 0) break;
      const have = avail[w.id][l.productId] || 0;
      if (have <= 0) continue;
      const take = Math.min(have, need);
      avail[w.id][l.productId] -= take;
      need -= take;
      usedWarehouses.add(w.id);
      allocations.push({ warehouseId: w.id, warehouseName: w.name, productId: l.productId, qty: take });
    }
    if (need > 0) backorder.push({ productId: l.productId, qty: need });
  }
  const shipments = usedWarehouses.size + (backorder.length ? 1 : 0); // backorder ships later
  const estCost = [...usedWarehouses].reduce((s, id) => {
    const w = sorted.find((x) => x.id === id);
    return s + (w?.shippingCostWeight || 0) * 10;
  }, 0);
  return { allocations, backorder, shipments, estCost: Math.round(estCost * 100) / 100 };
}
