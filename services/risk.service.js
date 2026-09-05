// Blended Discount Risk Score — section 10 of spec.
// allowed(line) = min(tierCeiling, categoryCeiling). Overage = max(0, given - allowed).
// blended = weightedAvgOverage + 0.5 * maxOverage (penalizes single bad line)
//         + small penalty if order-level discount pushes total beyond tier ceiling.
// Routing: score <= 0 -> NONE; 0 < score <= 5 -> MANAGER; score > 5 -> MANAGER_FINANCE.
// Also: any single line over by >= 8pts -> MANAGER_FINANCE. Order discount > tier+10 -> MANAGER_FINANCE.
export function evaluateQuote(quote, { tierCeiling, categoryCeilings, chains }) {
  const mgrUpTo = chains?.find((c) => c.enabled !== false)?.managerUpTo ?? 5;
  const lines = quote.lines || [];
  let gross = 0, net = 0, wOver = 0, maxOver = 0;
  const detail = [];
  for (const l of lines) {
    const g = (l.qty || 0) * (l.unitPrice || 0);
    const given = l.discountPct || 0;
    const catAllow = categoryCeilings[l.category] ?? 100;
    const allowed = Math.min(tierCeiling, catAllow);
    const over = Math.max(0, given - allowed);
    gross += g;
    net += g * (1 - given / 100);
    wOver += over * g;
    maxOver = Math.max(maxOver, over);
    detail.push({ lineId: l.id, given, allowed, over });
  }
  const orderDisc = gross ? (1 - net / gross) * 100 : 0;
  const avgOver = gross ? wOver / gross : 0;
  let score = avgOver + 0.5 * maxOver;
  if (orderDisc > tierCeiling + 2) score += (orderDisc - tierCeiling - 2) * 0.5;
  score = Math.round(score * 100) / 100;

  let level = "NONE";
  if (score > mgrUpTo || maxOver >= 8 || orderDisc > tierCeiling + 10) level = "MANAGER_FINANCE";
  else if (score > 0) level = "MANAGER";

  // Map level -> steps from approvalChains config
  const steps = level === "NONE" ? [] : level === "MANAGER"
    ? [{ role: "manager", status: "pending" }]
    : [{ role: "manager", status: "pending" }, { role: "finance", status: "pending" }];

  return { score, level, steps, orderDisc: Math.round(orderDisc * 100) / 100, avgOver: Math.round(avgOver * 100) / 100, maxOver, detail, tierCeiling, managerUpTo: mgrUpTo };
}
