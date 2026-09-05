// Deal health: stalled, discount anomaly, slippage.
export function healthReport(quotes, { stalledDays = 7 } = {}, repAvg = {}) {
  const alerts = [];
  const t = Date.now();
  for (const q of quotes) {
    const inactiveDays = (t - new Date(q.updatedAt).getTime()) / 86400000;
    if (["draft", "sent", "negotiation", "pending_approval"].includes(q.status) && inactiveDays > stalledDays) {
      alerts.push({ type: "stalled", quoteId: q.id, customer: q.customerName, days: Math.floor(inactiveDays), msg: `Inactive ${Math.floor(inactiveDays)}d` });
    }
    const avg = repAvg[q.ownerId];
    if (avg && (q.orderDisc || 0) > avg.avg + 2 * avg.std) {
      alerts.push({ type: "discount_anomaly", quoteId: q.id, customer: q.customerName, msg: `Discount ${q.orderDisc}% vs rep avg ${avg.avg}%` });
    }
    if (q.fulfillment?.backorder?.length) {
      alerts.push({ type: "slippage", quoteId: q.id, customer: q.customerName, msg: `${q.fulfillment.backorder.length} lines on backorder` });
    }
  }
  return alerts;
}
export function repDiscountStats(quotes) {
  const byRep = {};
  for (const q of quotes) {
    (byRep[q.ownerId] = byRep[q.ownerId] || []).push(q.orderDisc || 0);
  }
  const out = {};
  for (const [rep, arr] of Object.entries(byRep)) {
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length) || 3;
    out[rep] = { avg: Math.round(avg * 100) / 100, std: Math.round(std * 100) / 100 };
  }
  return out;
}
