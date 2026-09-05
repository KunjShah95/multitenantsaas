// Hybrid billing: one-time lines invoiced immediately; recurring lines generate schedule.
// proration: daily rate = unitPrice * qty * (1-disc) / daysInCycle; partial period charged pro-rata.
const CYCLE_DAYS = { monthly: 30, quarterly: 91, yearly: 365 };
export function buildSchedule(lines, startISO) {
  const start = new Date(startISO);
  const oneTime = [], recurring = [];
  for (const l of lines) {
    const net = l.qty * l.unitPrice * (1 - (l.discountPct || 0) / 100);
    if (l.billingType === "recurring") {
      const days = CYCLE_DAYS[l.cycle] || 30;
      // first period proration: days remaining in a 30d anchor month
      const dayOfMonth = start.getDate();
      const daysLeft = Math.max(1, 30 - dayOfMonth + 1);
      const proratedFirst = Math.round((net / days) * Math.min(daysLeft, days) * 100) / 100;
      const schedule = [
        { period: 1, due: start.toISOString().slice(0, 10), amount: proratedFirst, note: `Prorated ${Math.min(daysLeft, days)}/${days} days` },
      ];
      for (let i = 1; i < 3; i++) {
        const d = new Date(start); d.setDate(d.getDate() + days * i);
        schedule.push({ period: i + 1, due: d.toISOString().slice(0, 10), amount: Math.round(net * 100) / 100, note: "Full cycle" });
      }
      recurring.push({ lineId: l.id, cycle: l.cycle, perCycle: Math.round(net * 100) / 100, schedule });
    } else {
      oneTime.push({ lineId: l.id, amount: Math.round(net * 100) / 100 });
    }
  }
  const oneTimeTotal = Math.round(oneTime.reduce((s, x) => s + x.amount, 0) * 100) / 100;
  return { oneTime, recurring, oneTimeTotal, start: start.toISOString() };
}
export function cancelRefund(line, cycleStartISO, cancelISO) {
  const days = CYCLE_DAYS[line.cycle] || 30;
  const elapsed = Math.max(0, Math.floor((new Date(cancelISO) - new Date(cycleStartISO)) / 86400000));
  const remaining = Math.max(0, days - elapsed);
  const net = line.qty * line.unitPrice * (1 - (line.discountPct || 0) / 100);
  return Math.round((net * remaining / days) * 100) / 100;
}
// Mid-cycle modify (qty / cycle / discount change): prorated delta for remainder of cycle.
// Positive delta = extra charge; negative = refund/credit.
export function modifyProration(oldLine, changes, cycleStartISO, modifyISO) {
  const days = CYCLE_DAYS[oldLine.cycle] || 30;
  const elapsed = Math.max(0, Math.floor((new Date(modifyISO) - new Date(cycleStartISO)) / 86400000));
  const remaining = Math.max(0, days - elapsed);
  const oldNet = oldLine.qty * oldLine.unitPrice * (1 - (oldLine.discountPct || 0) / 100);
  const next = { ...oldLine, ...changes };
  const newDays = CYCLE_DAYS[next.cycle] || 30;
  const newNet = next.qty * next.unitPrice * (1 - (next.discountPct || 0) / 100);
  const delta = Math.round(((newNet / newDays) - (oldNet / days)) * remaining * 100) / 100;
  return { delta, newPerCycle: Math.round(newNet * 100) / 100, remainingDays: remaining, next };
}
