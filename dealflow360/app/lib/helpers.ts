import type { LineItem, QuoteStage, Route, StatusTone } from "./routes";

export const DEMO_RESET_CODE = "482916";

export const INITIAL_LINES: LineItem[] = [
  { id: "lp14", product: "Laptop Pro 14", category: "Hardware", qty: 2, price: 1200, discount: 12, cap: 15 },
  { id: "setup", product: "Onsite Setup Service", category: "Services", qty: 1, price: 450, discount: 16, cap: 10 },
  { id: "warranty", product: "Extended Warranty 2-Year", category: "Warranty", qty: 1, price: 180, discount: 10, cap: 10 }
];

export const KANBAN_LANES = ["Draft", "Pending approval", "Negotiation", "Approved", "Fulfillment", "Confirmed"] as const;
export type KanbanLane = (typeof KANBAN_LANES)[number];

export function laneForQuoteStage(stage: QuoteStage): KanbanLane {
  switch (stage) {
    case "Draft":
      return "Draft";
    case "Pending approval":
      return "Pending approval";
    case "Negotiation":
      return "Negotiation";
    case "Approved":
      return "Approved";
    case "Fulfillment":
    case "Subscribed":
      return "Fulfillment";
    case "Invoiced":
    case "Paid":
      return "Confirmed";
  }
}

export function toneForKanbanLane(lane: KanbanLane): StatusTone {
  switch (lane) {
    case "Pending approval":
      return "amber";
    case "Negotiation":
      return "blue";
    case "Approved":
    case "Confirmed":
      return "green";
    case "Fulfillment":
      return "steel";
    default:
      return "neutral";
  }
}

export function parseAmountToNumber(amount: string): number {
  const n = Number(amount.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export type PipelineDeal = {
  id: string;
  name: string;
  owner: string;
  amount: string;
  lane: KanbanLane;
  go: Route;
  live?: boolean;
};

export const STATIC_PIPELINE_DEALS: PipelineDeal[] = [
  { id: "Q-1046", name: "Helios Ltd", owner: "A. Chen", amount: "$9,400", lane: "Draft", go: "quote-builder" },
  { id: "Q-1039", name: "Beta Industries", owner: "D. Kumar", amount: "$18,200", lane: "Negotiation", go: "customer-portal" },
  { id: "Q-1041", name: "Zenith Co", owner: "L. Patel", amount: "$16,200", lane: "Negotiation", go: "customer-portal" },
  { id: "Q-1035", name: "Nova Retail", owner: "L. Patel", amount: "$54,200", lane: "Confirmed", go: "fulfillment" }
];

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
