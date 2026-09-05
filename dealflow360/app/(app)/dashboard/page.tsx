"use client";

import { FormEvent } from "react";
import { motion } from "framer-motion";
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
import { useStore } from "../../lib/store";
import {
  Badge, Button, Card, DataTable, DealCard, Empty, FlowStrip, Logo, Metric, NavIcon,
  PageHead, Skeleton, Stepper, ThemeToggle
} from "../../components/ui";
import { DEMO_RESET_CODE, KANBAN_LANES, downloadCsv, laneForQuoteStage, parseAmountToNumber, toneForKanbanLane } from "../../lib/helpers";
import { money, percent } from "../../lib/routes";

export default function DashboardPage() {
  const {
    theme, setTheme, resolved, toast, toastKind, setToast,
    quoteStage, setQuoteStage, quoteView, setQuoteView,
    dealLaneOverrides, setDealLaneOverrides, dragDealId,
    approvalFilter, setApprovalFilter, returnedQuotes,
    approvalDecision, setApprovalDecision,
    fulfillmentAccepted, setFulfillmentAccepted,
    subscriptionActive, setSubscriptionActive,
    invoicePaid, setInvoicePaid,
    counterDiscount, setCounterDiscount,
    discountRulesSaved, setDiscountRulesSaved,
    productStatus, setProductStatus,
    lines, setLines,
    resetStep, setResetStep, resetEmail, setResetEmail,
    totals, pipelineDeals, syncing, exporting,
    notify, navigate, runBusy, resetDemo,
    updateLineDiscount, updateLineQty, addUpsellToQuote,
    submitQuote, approveQuote, returnQuote, acceptSplit,
    generateInvoice, receivePayment, moveDeal
  } = useStore();
  return (
        <>
          <PageHead
            eyebrow="Revenue Command Center"
            title="Sales Pipeline & Operations"
            subtitle="Real-time deal health, approval workflows, margin safety, and fulfillment status."
            actions={
              <>
                <Button onClick={() => navigate("approvals")}><BadgeCheck size={15} aria-hidden="true" /> Approvals Queue</Button>
                <Button tone="primary" onClick={() => navigate("quote-builder")}><Plus size={15} aria-hidden="true" /> New Quote</Button>
              </>
            }
          />
          <motion.div className="hero" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
            <div className="hero-inner">
              <div>
                <p className="hero-kicker"><span className="pulse-dot" /> Live · Q3 close · {quoteStage}</p>
                <h2>Good morning, Alex. $117.8k is one approval away.</h2>
                <p>Q-1042 sits with Finance. Blended discount {percent(totals.blended)} {lines.some((l) => l.discount > l.cap) ? "is over cap. Resolve the Services line to unblock fulfillment." : "is within guardrails. Push it to fulfillment."}</p>
                <div className="hero-stats">
                  <div className="hero-stat"><b>$184.5k</b><span>Active pipeline · 12 quotes</span></div>
                  <div className="hero-stat"><b>{money(totals.net)}</b><span>Q-1042 net payable</span></div>
                  <div className="hero-stat"><b>88.4%</b><span>Margin protected</span></div>
                </div>
              </div>
              <div className="hero-cta">
                <Button tone="primary" onClick={() => navigate("approval-detail")}>Resolve Q-1042 <ArrowRight size={14} /></Button>
                <Button onClick={() => navigate("deal-health")}><Activity size={14} /> Risk radar</Button>
              </div>
            </div>
          </motion.div>
          <FlowStrip
            quoteStage={quoteStage}
            blended={totals.blended}
            overCap={lines.some((l) => l.discount > l.cap)}
            fulfillmentAccepted={fulfillmentAccepted}
            subscriptionActive={subscriptionActive}
            invoicePaid={invoicePaid}
            counterDiscount={counterDiscount}
            onGo={(r) => navigate(r)}
          />
          <div className="grid grid-3">
            <Metric
              title="Escalated Approvals"
              value="4"
              detail="$117,800 awaiting sign-off"
              tone="amber"
              icon={<BadgeAlert size={14} aria-hidden="true" />}
              trend="+2 today"
              meter={{ pct: 65, tone: "warn" }}
              onClick={() => navigate("approvals")}
            />
            <Metric
              title="Active Pipeline"
              value="$184,500"
              detail="12 enterprise quotes active"
              tone="blue"
              icon={<FileText size={14} aria-hidden="true" />}
              trend="+14.8% vs last month"
              meter={{ pct: 82, tone: "good" }}
              onClick={() => navigate("quotations")}
            />
            <Metric
              title="At Risk / Anomalies"
              value="3 Deals"
              detail="Margin erosion & stock alerts"
              tone="red"
              icon={<ShieldAlert size={14} aria-hidden="true" />}
              trend="Action required"
              meter={{ pct: 30, tone: "bad" }}
              onClick={() => navigate("deal-health")}
            />
          </div>
          <div className="split" style={{ marginTop: 8 }}>
            <Card title="Live Deal Activity & Audit Stream" action={<Badge tone="green"><span className="pulse-dot" /> Live ERP Sync</Badge>}>
              <DataTable
                headers={["Account", "Event", "Pipeline Stage", "Timeline", "Action"]}
                rows={[
                  [
                    <strong key="a">Acme Corp<br /><span className="subtle">Q-1042 ({money(totals.net)})</span></strong>,
                    "Sales Lead approved; Finance Director pending",
                    <Badge tone="amber" key="b"><Clock size={11} /> Approval</Badge>,
                    "24m ago",
                    <Button key="btn" tone="primary" onClick={() => navigate("approval-detail")}>Inspect <ArrowRight size={13} /></Button>
                  ],
                  [
                    <strong key="a">Beta Industries<br /><span className="subtle">Q-1039 ($18,200)</span></strong>,
                    "Customer requested 12% discount counter proposal",
                    <Badge tone="blue" key="b"><UserRound size={11} /> Negotiation</Badge>,
                    "1h ago",
                    <Button key="btn" onClick={() => navigate("customer-portal")}>Portal View</Button>
                  ],
                  [
                    <strong key="a">East Coast Depot<br /><span className="subtle">ORD-8021</span></strong>,
                    "40 Docking Stations restocked into primary inventory",
                    <Badge tone="steel" key="b"><Warehouse size={11} /> Stock</Badge>,
                    "3h ago",
                    <Button key="btn" onClick={() => navigate("fulfillment")}>Fulfillment</Button>
                  ],
                  [
                    <strong key="a">Delta LLC<br /><span className="subtle">INV-1038 ($9,800)</span></strong>,
                    "Stripe automatic invoice settlement confirmed",
                    <Badge tone="green" key="b"><CheckCircle2 size={11} /> Paid</Badge>,
                    "5h ago",
                    <Button key="btn" onClick={() => navigate("invoice-detail")}>Invoice</Button>
                  ]
                ]}
              />
            </Card>
            <div className="grid">
              <Card title="Quick Actions & Config">
                <div className="grid" style={{ gap: 10 }}>
                  <Button onClick={() => navigate("discount-setup")}><SlidersHorizontal size={15} aria-hidden="true" /> Discount Governance Setup</Button>
                  <Button onClick={() => navigate("fulfillment")}><Truck size={15} aria-hidden="true" /> Warehouse Allocation Engine</Button>
                  <Button onClick={() => navigate("reports")}><Download size={15} aria-hidden="true" /> Export Revenue Reports</Button>
                  <Button onClick={() => navigate("deal-health")}><Activity size={15} aria-hidden="true" /> Deal Health Diagnostics</Button>
                </div>
              </Card>
              <Card title="Margin Protection Guard">
                <div className="grid" style={{ gap: 8 }}>
                  <div className="cluster" style={{ justifyContent: "space-between" }}>
                    <span className="subtle">Average Blended Margin</span>
                    <strong className="mono" style={{ color: "var(--green)" }}>88.4%</strong>
                  </div>
                  <div className="meter good"><span style={{ width: "88.4%" }} /></div>
                  <div className="cluster" style={{ justifyContent: "space-between", marginTop: 4 }}>
                    <span className="subtle">Max Allowed Concession</span>
                    <span className="mono">15.0%</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
  );
}
