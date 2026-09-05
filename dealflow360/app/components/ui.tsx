"use client";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeAlert,
  BadgeCheck,
  BadgePercent,
  BarChart3,
  Box,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  Inbox,
  Info,
  KeyRound,
  Layers,
  LayoutDashboard,
  Loader2,
  Lock,
  MailCheck,
  Minus,
  MonitorSmartphone,
  Moon,
  Package,
  PackageCheck,
  Percent,
  Plus,
  Receipt,
  RefreshCw,
  Repeat,
  RotateCcw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tag,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Truck,
  User,
  UserCheck,
  UserRound,
  Users,
  Wallet,
  Warehouse,
  X
} from "lucide-react";
import { flowRoutes, money, percent, routeNames, type QuoteStage, type Route, type StatusTone, type Theme, type ToastKind } from "../lib/routes";
import { useStore } from "../lib/store";

export function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <div className="theme-segmented" role="radiogroup" aria-label="Theme Selection">
      <button
        type="button"
        className={`theme-seg-btn ${theme === "light" ? "active" : ""}`}
        onClick={() => onChange("light")}
        data-tip="Light Theme"
        aria-label="Switch to Light Theme"
        aria-checked={theme === "light"}
        role="radio"
      >
        <Sun size={13} aria-hidden="true" />
        <span>Light</span>
      </button>
      <button
        type="button"
        className={`theme-seg-btn ${theme === "dark" ? "active" : ""}`}
        onClick={() => onChange("dark")}
        data-tip="Dark Theme"
        aria-label="Switch to Dark Theme"
        aria-checked={theme === "dark"}
        role="radio"
      >
        <Moon size={13} aria-hidden="true" />
        <span>Dark</span>
      </button>
      <button
        type="button"
        className={`theme-seg-btn ${theme === "system" ? "active" : ""}`}
        onClick={() => onChange("system")}
        data-tip="System Default"
        aria-label="Switch to System Theme"
        aria-checked={theme === "system"}
        role="radio"
      >
        <MonitorSmartphone size={13} aria-hidden="true" />
        <span>Auto</span>
      </button>
    </div>
  );
}

export function Logo({ compact = false, onDark = false }: { compact?: boolean; onDark?: boolean }) {
  return (
    <span className="logo">
      <svg className="logo-mark" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <rect width="34" height="34" rx="10" fill="#1d4ed8" />
        <rect x="0.5" y="0.5" width="33" height="33" rx="9.5" fill="none" stroke="#ffffff" strokeOpacity="0.3" />
        <path d="M8 22 L14 15.5 L18 18.5 L25.5 10" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20.8 10 H25.5 V14.7" fill="none" stroke="#bcd0f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="14" cy="15.5" r="2" fill="#34d399" stroke="#ffffff" strokeWidth="1" />
      </svg>
      <span className="logo-text">
        <span className="logo-name" style={onDark ? { color: "#ffffff" } : undefined}>DealFlow <span className="logo-num">360</span></span>
        {!compact && <span className="logo-tag" style={onDark ? { color: "#aeb8e2" } : undefined}>Revenue Operations OS</span>}
      </span>
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: StatusTone }) {
  return <span className={`badge ${tone === "neutral" ? "" : tone}`}>{children}</span>;
}

export function Button({
  children,
  onClick,
  tone,
  disabled,
  type = "button",
  testId,
  tip,
  ariaLabel
}: {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  tone?: "primary" | "danger" | "success" | "accent" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  testId?: string;
  tip?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      className={`button ${tone ?? ""}`}
      data-testid={testId}
      data-tip={tip}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

export function Skeleton({ width = "100%", height = 16 }: { width?: string | number; height?: string | number }) {
  return <span className="skeleton" style={{ width, height }} aria-hidden="true" />;
}

export function Empty({ icon, title, hint, action }: { icon: React.ReactNode; title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="empty" role="status">
      {icon}
      <strong>{title}</strong>
      <span className="subtle">{hint}</span>
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = ""
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <div className="card-head">
          <h2>{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="card-pad">{children}</div>
    </section>
  );
}

export function PageHead({
  eyebrow,
  title,
  subtitle,
  actions
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtle">{subtitle}</p>
      </div>
      {actions ? <div className="row-actions">{actions}</div> : null}
    </div>
  );
}

export function DataTable({
  headers,
  rows
}: {
  headers: React.ReactNode[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{headers.map((header, index) => <th key={index} scope="col">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Stepper({ active }: { active: number }) {
  const steps = ["Quotation Draft", "Discount Approval", "Stock Allocation", "Invoiced", "Reconciled & Paid"];
  return (
    <div className="pipeline">
      {steps.map((step, index) => (
        <span className="cluster" key={step}>
          <span className={`step ${index < active ? "done" : index === active ? "active" : ""}`}>
            <span className="dot" />
            <span>{step}</span>
          </span>
          {index < steps.length - 1 ? <span className="connector" /> : null}
        </span>
      ))}
    </div>
  );
}

export function NavIcon({ route }: { route: string }) {
  const props = { size: 16, "aria-hidden": true } as const;
  switch (route) {
    case "dashboard":
      return <LayoutDashboard {...props} />;
    case "quotations":
      return <FileText {...props} />;
    case "approvals":
      return <BadgeCheck {...props} />;
    case "fulfillment":
      return <Package {...props} />;
    case "subscriptions":
      return <Repeat {...props} />;
    case "invoices":
      return <Receipt {...props} />;
    case "deal-health":
      return <Activity {...props} />;
    case "reports":
      return <BarChart3 {...props} />;
    case "products":
      return <Tag {...props} />;
    case "customer-portal":
      return <UserRound {...props} />;
    default:
      return <LayoutDashboard {...props} />;
  }
}

export const sideGroups: { title: string; items: { route: Route; label: string; count?: string }[] }[] = [
  {
    title: "Operations Flow",
    items: [
      { route: "dashboard", label: "Dashboard" },
      { route: "quotations", label: "Quotations", count: "12" },
      { route: "approvals", label: "Approvals", count: "4" },
      { route: "fulfillment", label: "Fulfillment", count: "7" },
      { route: "subscriptions", label: "Subscriptions" },
      { route: "invoices", label: "Invoices", count: "1" }
    ]
  },
  {
    title: "Intelligence & Config",
    items: [
      { route: "deal-health", label: "Deal Health", count: "3" },
      { route: "reports", label: "Reports" },
      { route: "products", label: "Products" },
      { route: "customer-portal", label: "Customer Portal" }
    ]
  }
];


export function DemoTour({ route, quoteStage, onNavigate, onReset }: { route: Route; quoteStage: QuoteStage; onNavigate: (route: Route, message?: string) => void; onReset: () => void }) {
  const index = Math.max(0, flowRoutes.indexOf(route));
  const prev = flowRoutes[index - 1];
  const next = flowRoutes[index + 1];
  return (
    <nav className="demo-tour" aria-label="Guided demo tour navigation">
      <div className="cluster">
        <Badge tone="blue">Step {index + 1} of {flowRoutes.length}</Badge>
        <strong>{routeNames[route]}</strong>
        <span className="subtle">Lifecycle Status: {quoteStage}</span>
      </div>
      <div className="cluster">
        <Button disabled={!prev} onClick={() => prev && onNavigate(prev)} ariaLabel={prev ? `Go back to ${routeNames[prev]}` : "No previous view"}>
          <ChevronLeft size={15} aria-hidden="true" /> Previous
        </Button>
        <Button disabled={!next} onClick={() => next && onNavigate(next)} tone="primary" ariaLabel={next ? `Proceed to ${routeNames[next]}` : "End of tour"}>
          Next: {next ? routeNames[next] : "Complete"} <ChevronRight size={15} aria-hidden="true" />
        </Button>
        <Button onClick={onReset} tip="Reset all demo state to start">
          <RotateCcw size={15} aria-hidden="true" /> Reset Demo
        </Button>
      </div>
    </nav>
  );
}


export function Metric({
  title,
  value,
  detail,
  tone,
  meter,
  icon,
  trend,
  onClick
}: {
  title: string;
  value: string;
  detail: string;
  tone: StatusTone;
  meter?: { pct: number; tone: "good" | "warn" | "bad" };
  icon?: React.ReactNode;
  trend?: string;
  onClick?: () => void;
}) {
  const up = trend ? /\+|target|live/i.test(trend) : false;
  return (
    <div
      className={`card metric ${onClick ? "clickable-card" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${title}: ${value}. ${detail}`}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div>
        <div className="metric-head">
          <span className="cluster" style={{ gap: 8 }}>
            <span className="icon-tile">{icon}</span>
            <span className="section-label">{title}</span>
          </span>
          {trend ? <span className={`trend-pill ${up ? "up" : ""}`}>{trend}</span> : null}
        </div>
        <div className="metric-value mono">{value}</div>
        <p className="subtle">{detail}</p>
      </div>
      {meter ? (
        <div className={`meter ${meter.tone}`} role="img" aria-label={`${title}: ${Math.round(meter.pct)} percent`}>
          <span style={{ width: `${Math.min(100, Math.max(0, meter.pct))}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export function FlowStrip({
  quoteStage,
  blended,
  overCap,
  fulfillmentAccepted,
  subscriptionActive,
  invoicePaid,
  counterDiscount,
  onGo
}: {
  quoteStage: QuoteStage;
  blended: number;
  overCap: boolean;
  fulfillmentAccepted: boolean;
  subscriptionActive: boolean;
  invoicePaid: boolean;
  counterDiscount: string;
  onGo: (r: Route) => void;
}) {
  const approved = quoteStage === "Approved" || quoteStage === "Fulfillment" || quoteStage === "Subscribed" || quoteStage === "Invoiced" || quoteStage === "Paid";
  const shipped = quoteStage === "Fulfillment" || quoteStage === "Subscribed" || quoteStage === "Invoiced" || quoteStage === "Paid";
  const billed = subscriptionActive || quoteStage === "Invoiced" || quoteStage === "Paid";
  
  const nodes: { num: string; label: string; sub: string; state: "done" | "now" | "todo"; go: Route }[] = [
    { num: "01", label: "Quotation", sub: "Q-1042 Config", state: "done", go: "quote-builder" },
    { num: "02", label: "Discount / Risk", sub: overCap ? `${percent(blended)} (Over Cap)` : `${percent(blended)} (OK)`, state: overCap ? "now" : "done", go: "quote-builder" },
    { num: "03", label: "Approval", sub: approved ? "Approved" : quoteStage === "Pending approval" || quoteStage === "Negotiation" ? "In Review" : "Draft", state: approved ? "done" : quoteStage === "Pending approval" || quoteStage === "Negotiation" ? "now" : "todo", go: "approvals" },
    { num: "04", label: "Upsell", sub: "3 Bundles Active", state: approved ? "done" : "todo", go: "quote-builder" },
    { num: "05", label: "Fulfillment", sub: fulfillmentAccepted ? "Split Active" : shipped ? "Ready" : "Waiting", state: fulfillmentAccepted || shipped ? "done" : approved ? "now" : "todo", go: "fulfillment" },
    { num: "06", label: "Negotiation", sub: `${counterDiscount}% Counter`, state: quoteStage === "Negotiation" ? "now" : approved ? "done" : "todo", go: "customer-portal" },
    { num: "07", label: "Billing", sub: billed ? "Plan Active" : "No Plan", state: billed ? "done" : shipped ? "now" : "todo", go: "subscriptions" },
    { num: "08", label: "Payment", sub: invoicePaid ? "Reconciled" : "Open", state: invoicePaid ? "done" : billed ? "now" : "todo", go: "invoices" }
  ];

  return (
    <div className="flow-strip" role="group" aria-label="DealFlow360 Lifecycle: Quote to Cash">
      {nodes.map((n) => (
        <button
          key={n.label}
          className={`flow-node ${n.state}`}
          onClick={() => onGo(n.go)}
          type="button"
          aria-label={`${n.num} ${n.label}: ${n.sub}`}
          aria-current={n.state === "now" ? "step" : undefined}
        >
          <div className="cluster" style={{ justifyContent: "space-between", width: "100%" }}>
            <span className="fn-step-num">{n.num}</span>
            <span className="fn-dot" aria-hidden="true" />
          </div>
          <span className="fn-label">{n.label}</span>
          <span className="fn-sub">{n.sub}</span>
        </button>
      ))}
    </div>
  );
}

export function DealCard({
  name,
  id,
  amount,
  tone,
  owner,
  live,
  onOpen,
  draggable,
  onDragStart,
  movePrev,
  moveNext,
  prevLabel,
  nextLabel
}: {
  name: string;
  id: string;
  amount: string;
  tone: StatusTone;
  owner?: string;
  live?: boolean;
  onOpen: () => void;
  draggable?: boolean;
  onDragStart?: (e?: React.DragEvent) => void;
  movePrev?: () => void;
  moveNext?: () => void;
  prevLabel?: string;
  nextLabel?: string;
}) {
  return (
    <div
      className={`deal-card${live ? " live" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
      role="article"
      aria-label={`${name} ${id} ${amount}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && (e.target as HTMLElement).tagName !== "BUTTON") {
          const t = e.target as HTMLElement;
          if (t.classList.contains("deal-card")) onOpen();
        }
      }}
    >
      <button className="deal-card-main" onClick={onOpen} type="button" aria-label={`Open ${name} ${id}`}>
        <span className="cluster" style={{ justifyContent: "space-between" }}>
          <strong>{name}</strong>
          <Badge tone={tone}>{id}</Badge>
        </span>
        <span className="mono" style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "-0.03em", display: "block", textAlign: "left" }}>{amount}</span>
        <span className="cluster" style={{ justifyContent: "space-between" }}>
          <span className="subtle">{owner ? `${owner} · Enterprise package` : "Enterprise Pricing Package"}</span>
          {live ? <span className="live-dot" aria-label="Live deal" /> : <span className="subtle mono">→</span>}
        </span>
      </button>
      {movePrev || moveNext ? (
        <div className="deal-card-moves">
          {movePrev ? <button type="button" className="button sm" onClick={movePrev} aria-label={`Move ${id} to ${prevLabel}`}>← Prev</button> : <span />}
          {moveNext ? <button type="button" className="button sm" onClick={moveNext} aria-label={`Move ${id} to ${nextLabel}`}>Next →</button> : <span />}
        </div>
      ) : null}
    </div>
  );
}

export function FlowAudit({ route }: { route: Route }) {
  return (
    <div aria-label="Prototype route coverage" data-prototype-flow={flowRoutes.join(",")} hidden>
      {route}
    </div>
  );
}

export function Toasts() {
  const { toast, toastKind, setToast } = useStore();
  if (!toast) return null;
  return (
    <div className="toast-stack" aria-live="polite">
      <div className={`toast ${toastKind}`} role="status">
        {toastKind === "success" ? <CircleCheck size={16} aria-hidden="true" /> : toastKind === "error" ? <TriangleAlert size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}
        <span>{toast}</span>
        <button className="toast-close" onClick={() => setToast("")} aria-label="Dismiss message" type="button">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}