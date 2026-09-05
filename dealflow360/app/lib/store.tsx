"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";
import { INITIAL_LINES, STATIC_PIPELINE_DEALS, laneForQuoteStage, type KanbanLane, type PipelineDeal } from "./helpers";
import {
  money,
  pathForRoute,
  routeNames,
  type LineItem,
  type QuoteStage,
  type Route,
  type Theme,
  type ToastKind
} from "./routes";

function useTheme() {
  const [theme, setTheme] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("df360-theme") as Theme | null;
      if (saved === "light" || saved === "dark" || saved === "system") setTheme(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.dataset.theme = theme;
      setResolved(dark ? "dark" : "light");
    };
    apply();
    mq.addEventListener("change", apply);
    try {
      localStorage.setItem("df360-theme", theme);
    } catch {
      /* storage unavailable */
    }
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  return { theme, setTheme, resolved };
}

export type Store = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark";
  toast: string;
  toastKind: ToastKind;
  setToast: (message: string) => void;
  quoteStage: QuoteStage;
  setQuoteStage: (stage: QuoteStage) => void;
  quoteView: "cards" | "table";
  setQuoteView: (view: "cards" | "table") => void;
  dealLaneOverrides: Partial<Record<string, KanbanLane>>;
  setDealLaneOverrides: (overrides: Partial<Record<string, KanbanLane>>) => void;
  dragDealId: React.MutableRefObject<string | null>;
  approvalFilter: string;
  setApprovalFilter: (filter: string) => void;
  returnedQuotes: string[];
  approvalDecision: string;
  setApprovalDecision: (decision: string) => void;
  fulfillmentAccepted: boolean;
  setFulfillmentAccepted: (accepted: boolean) => void;
  subscriptionActive: boolean;
  setSubscriptionActive: (active: boolean) => void;
  invoicePaid: boolean;
  setInvoicePaid: (paid: boolean) => void;
  counterDiscount: string;
  setCounterDiscount: (discount: string) => void;
  discountRulesSaved: boolean;
  setDiscountRulesSaved: (saved: boolean) => void;
  productStatus: string;
  setProductStatus: (status: string) => void;
  lines: LineItem[];
  setLines: React.Dispatch<React.SetStateAction<LineItem[]>>;
  resetStep: "email" | "code" | "reset";
  setResetStep: (step: "email" | "code" | "reset") => void;
  resetEmail: string;
  setResetEmail: (email: string) => void;
  totals: { gross: number; net: number; concession: number; blended: number };
  pipelineDeals: PipelineDeal[];
  syncing: boolean;
  exporting: string | null;
  notify: (message: string, kind?: ToastKind) => void;
  navigate: (nextRoute: Route, message?: string, kind?: ToastKind) => void;
  runBusy: (key: string, done: () => void, ms?: number) => void;
  resetDemo: () => void;
  updateLineDiscount: (id: string, value: string) => void;
  updateLineQty: (id: string, value: string) => void;
  addUpsellToQuote: (item: { product: string; category: string; price: number; cap: number }) => void;
  submitQuote: () => void;
  approveQuote: () => void;
  returnQuote: () => void;
  acceptSplit: () => void;
  generateInvoice: () => void;
  receivePayment: () => void;
  moveDeal: (id: string, lane: KanbanLane) => void;
};

const StoreContext = createContext<Store | null>(null);

export function DealFlowProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { theme, setTheme, resolved } = useTheme();
  const [toast, setToast] = useState("");
  const [toastKind, setToastKind] = useState<ToastKind>("info");
  const [quoteStage, setQuoteStage] = useState<QuoteStage>("Draft");
  const [quoteView, setQuoteView] = useState<"cards" | "table">("cards");
  const [dealLaneOverrides, setDealLaneOverrides] = useState<Partial<Record<string, KanbanLane>>>({});
  const dragDealId = useRef<string | null>(null);
  const [approvalFilter, setApprovalFilter] = useState("All");
  const [returnedQuotes, setReturnedQuotes] = useState<string[]>([]);
  const [approvalDecision, setApprovalDecision] = useState("Finance review pending");
  const [fulfillmentAccepted, setFulfillmentAccepted] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [invoicePaid, setInvoicePaid] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const busyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [counterDiscount, setCounterDiscount] = useState("14.5");
  const [discountRulesSaved, setDiscountRulesSaved] = useState(false);
  const [productStatus, setProductStatus] = useState("Draft");
  const [lines, setLines] = useState<LineItem[]>(INITIAL_LINES);
  const [resetStep, setResetStep] = useState<"email" | "code" | "reset">("email");
  const [resetEmail, setResetEmail] = useState("alex.chen@acmeops.io");

  const totals = useMemo(() => {
    const gross = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
    const net = lines.reduce((sum, line) => sum + line.qty * line.price * (1 - line.discount / 100), 0);
    const concession = gross - net;
    return { gross, net, concession, blended: gross ? (concession / gross) * 100 : 0 };
  }, [lines]);

  const pipelineDeals: PipelineDeal[] = useMemo(() => {
    const liveDeal: PipelineDeal = {
      id: "Q-1042",
      name: "Acme Corp",
      owner: "M. Shah",
      amount: money(totals.net),
      lane: laneForQuoteStage(quoteStage),
      go: "quote-builder",
      live: true
    };
    return [liveDeal, ...STATIC_PIPELINE_DEALS.map((d) => (dealLaneOverrides[d.id] ? { ...d, lane: dealLaneOverrides[d.id] as KanbanLane } : d))];
  }, [totals.net, quoteStage, dealLaneOverrides]);

  const notify = useCallback((message: string, kind: ToastKind = "info") => {
    if (busyTimer.current) clearTimeout(busyTimer.current);
    setToast(message);
    setToastKind(kind);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToast("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    return () => {
      if (busyTimer.current) clearTimeout(busyTimer.current);
    };
  }, []);

  // One-time upgrade of legacy hash deep-links (#/dashboard) to real paths.
  useEffect(() => {
    try {
      const hash = window.location.hash.replace(/^#\/?/, "");
      if (hash && /^[a-z-]+$/.test(hash)) {
        router.replace(hash === "login" ? "/signin" : `/${hash}`);
      }
    } catch {
      /* best-effort */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runBusy = useCallback((key: string, done: () => void, ms = 900) => {
    if (key === "sync") setSyncing(true);
    else setExporting(key);
    busyTimer.current = setTimeout(() => {
      if (key === "sync") setSyncing(false);
      else setExporting(null);
      done();
    }, ms);
  }, []);

  const navigate = useCallback((nextRoute: Route, message?: string, kind: ToastKind = "info") => {
    router.push(pathForRoute(nextRoute));
    notify(message ?? `${routeNames[nextRoute]} loaded`, kind);
  }, [router, notify]);

  const moveDeal = useCallback((id: string, lane: KanbanLane) => {
    if (id === "Q-1042") {
      const stageForLane: Record<KanbanLane, QuoteStage> = {
        Draft: "Draft",
        "Pending approval": "Pending approval",
        Negotiation: "Negotiation",
        Approved: "Approved",
        Fulfillment: "Fulfillment",
        Confirmed: "Invoiced"
      };
      setQuoteStage(stageForLane[lane]);
      setReturnedQuotes((q) => (lane === "Draft" ? (q.includes(id) ? q : [...q, id]) : q.filter((x) => x !== id)));
      notify(`${id} moved to ${lane}`, "success");
      return;
    }
    setDealLaneOverrides((prev) => ({ ...prev, [id]: lane }));
    notify(`${id} moved to ${lane}`, "success");
  }, [notify]);

  const resetDemo = useCallback(() => {
    setQuoteStage("Draft");
    setApprovalDecision("Finance review pending");
    setFulfillmentAccepted(false);
    setSubscriptionActive(false);
    setInvoicePaid(false);
    setDiscountRulesSaved(false);
    setProductStatus("Draft");
    setReturnedQuotes([]);
    setDealLaneOverrides({});
    setApprovalFilter("All");
    setQuoteView("cards");
    setCounterDiscount("14.5");
    setLines(INITIAL_LINES);
    navigate("signin", "Demo state reset to initial baseline", "info");
  }, [navigate]);

  const updateLineDiscount = useCallback((id: string, value: string) => {
    if (value.trim() === "") return;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(100, Math.max(0, parsed));
    setLines((current) => current.map((line) => (line.id === id ? { ...line, discount: clamped } : line)));
  }, []);

  const updateLineQty = useCallback((id: string, value: string) => {
    if (value.trim() === "") return;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.max(1, Math.floor(parsed) || 1);
    setLines((current) => current.map((line) => (line.id === id ? { ...line, qty: clamped } : line)));
  }, []);

  const addUpsellToQuote = useCallback((item: { product: string; category: string; price: number; cap: number }) => {
    const id = `upsell-${Date.now().toString(36)}`;
    setLines((current) => [...current, { id, qty: 1, discount: 0, ...item }]);
    notify(`${item.product} added to Q-1042 at ${money(item.price)}`, "success");
  }, [notify]);

  const submitQuote = useCallback(() => {
    setQuoteStage("Pending approval");
    setApprovalDecision("Sales Lead approved; Finance Director pending");
    setReturnedQuotes((q) => q.filter((id) => id !== "Q-1042"));
    navigate("approvals", "Q-1042 escalated to approval matrix", "success");
  }, [navigate]);

  const approveQuote = useCallback(() => {
    if (quoteStage === "Draft") {
      notify("Submit Q-1042 for approval before approving", "error");
      return;
    }
    setQuoteStage("Approved");
    setApprovalDecision("Approved by Sales Ops & Finance Director");
    navigate("fulfillment", "Q-1042 approved. Stock reservation allocated.", "success");
  }, [navigate, notify, quoteStage]);

  const returnQuote = useCallback(() => {
    setQuoteStage("Draft");
    setApprovalDecision("Returned to sales rep for discount adjustment");
    setReturnedQuotes((q) => (q.includes("Q-1042") ? q : [...q, "Q-1042"]));
    notify("Q-1042 returned to sales rep with feedback note", "info");
  }, [notify]);

  const acceptSplit = useCallback(() => {
    setFulfillmentAccepted(true);
    setQuoteStage("Fulfillment");
    navigate("subscriptions", "Split fulfillment accepted. Plan initiated.", "success");
  }, [navigate]);

  const generateInvoice = useCallback(() => {
    if (quoteStage === "Draft" || quoteStage === "Pending approval" || quoteStage === "Negotiation") {
      notify("Approve Q-1042 and accept fulfillment before invoicing", "error");
      return;
    }
    if (!fulfillmentAccepted && quoteStage === "Approved") {
      notify("Accept split fulfillment before generating invoice", "error");
      return;
    }
    setSubscriptionActive(true);
    setQuoteStage("Invoiced");
    navigate("invoices", "Invoice INV-1042 generated from subscription", "success");
  }, [navigate, notify, quoteStage, fulfillmentAccepted]);

  const receivePayment = useCallback(() => {
    setInvoicePaid(true);
    setQuoteStage("Paid");
    notify("Payment received via Stripe. Books reconciled.", "success");
  }, [notify]);

  const value: Store = {
    theme, setTheme, resolved,
    toast, toastKind, setToast,
    quoteStage, setQuoteStage,
    quoteView, setQuoteView,
    dealLaneOverrides, setDealLaneOverrides,
    dragDealId,
    approvalFilter, setApprovalFilter,
    returnedQuotes,
    approvalDecision, setApprovalDecision,
    fulfillmentAccepted, setFulfillmentAccepted,
    subscriptionActive, setSubscriptionActive,
    invoicePaid, setInvoicePaid,
    counterDiscount, setCounterDiscount,
    discountRulesSaved, setDiscountRulesSaved,
    productStatus, setProductStatus,
    lines, setLines,
    resetStep, setResetStep,
    resetEmail, setResetEmail,
    totals, pipelineDeals,
    syncing, exporting,
    notify, navigate, runBusy, resetDemo,
    updateLineDiscount, updateLineQty, addUpsellToQuote,
    submitQuote, approveQuote, returnQuote, acceptSplit, generateInvoice, receivePayment,
    moveDeal
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside DealFlowProvider");
  return store;
}
