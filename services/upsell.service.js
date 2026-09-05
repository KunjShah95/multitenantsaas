// Ranked upsell/cross-sell: score = coPurchase weight + promotion boost, filtered by margin threshold.
export function suggest(lines, products, rules, minMarginPct = 0) {
  const inCart = new Set(lines.map((l) => l.productId));
  const out = [];
  for (const r of rules) {
    // rule: {triggerProductId, suggestedProductId, weight, promoted}
    if (!inCart.has(r.triggerProductId)) continue;
    if (inCart.has(r.suggestedProductId)) continue;
    const p = products.find((x) => x.id === r.suggestedProductId);
    if (!p) continue;
    const marginPct = p.unitCost ? ((p.price - p.unitCost) / p.price) * 100 : 100;
    if (marginPct < (r.minMarginPct ?? minMarginPct)) continue;
    const score = (r.weight || 1) + (r.promoted ? 5 : 0) + marginPct / 50;
    const marginDelta = Math.round((p.price - (p.unitCost || 0)) * 100) / 100;
    out.push({ productId: p.id, name: p.name, price: p.price, marginPct: Math.round(marginPct * 100) / 100, marginDelta, promoted: !!r.promoted, score: Math.round(score * 100) / 100 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}
export function quoteMargin(lines, products) {
  let rev = 0, cost = 0;
  for (const l of lines) {
    const p = products.find((x) => x.id === l.productId);
    const unitCost = p?.unitCost || 0;
    rev += l.qty * l.unitPrice * (1 - (l.discountPct || 0) / 100);
    cost += l.qty * unitCost;
  }
  const margin = rev - cost;
  return { revenue: Math.round(rev * 100) / 100, cost: Math.round(cost * 100) / 100, margin: Math.round(margin * 100) / 100, marginPct: rev ? Math.round((margin / rev) * 10000) / 100 : 0 };
}
