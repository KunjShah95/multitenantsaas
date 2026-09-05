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

export default function QuoteBuilderPage() {
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
            eyebrow="Quote Configurator"
            title="Quotation Q-1042: Acme Corp"
            subtitle="Gold Tier Pricing. Automated margin guard and multi-tier approval checks."
            actions={
              <>
                <Badge tone={totals.blended > 10 ? "red" : "green"}>
                  <Percent size={11} /> {percent(totals.blended)} Blended Discount
                </Badge>
                <Button onClick={() => notify("Quote changes saved to draft", "info")}>Save Draft</Button>
                <Button tone="primary" onClick={submitQuote}>
                  <Send size={15} /> Submit for Approval
                </Button>
              </>
            }
          />
          {lines.some((line) => line.discount > line.cap) ? (
            <div className="notice red">
              <div className="cluster">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>Multi-level Approval Required: Services discount (16.0%) exceeds the Tier Cap (10.0%).</span>
              </div>
              <Badge tone="red">Escalation Triggered</Badge>
            </div>
          ) : (
            <div className="notice green">
              <div className="cluster">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Standard Concession: Blended discount is within sales rep authority limit.</span>
              </div>
              <Badge tone="green">Auto-Pass Eligible</Badge>
            </div>
          )}
          <div className="split">
            <Card title="Line Items & Concession Matrix" action={<Badge tone="blue">{lines.length} Line Items</Badge>}>
              <DataTable
                headers={["Product & Category", "Qty", "List Price", "Discount %", "Tier Cap", "Net Total", "Compliance"]}
                rows={lines.map((line) => [
                  <div key="p">
                    <strong>{line.product}</strong>
                    <div className="subtle">{line.category}</div>
                  </div>,
                  <input
                    key="q"
                    min={1}
                    aria-label={`Quantity for ${line.product}`}
                    onChange={(event) => updateLineQty(line.id, event.target.value)}
                    style={{ width: 68 }}
                    type="number"
                    value={line.qty}
                  />,
                  <span className="mono" key="l">{money(line.price)}</span>,
                  <input
                    key="d"
                    aria-label={`Discount percentage for ${line.product}`}
                    onChange={(event) => updateLineDiscount(line.id, event.target.value)}
                    style={{ width: 80 }}
                    type="number"
                    value={line.discount}
                  />,
                  <span className="mono" key="c">{percent(line.cap)}</span>,
                  <span className="mono" key="n" style={{ fontWeight: 600 }}>{money(line.qty * line.price * (1 - line.discount / 100))}</span>,
                  <Badge key="a" tone={line.discount > line.cap ? "red" : "green"}>
                    {line.discount > line.cap ? "Over Cap" : "Compliant"}
                  </Badge>
                ])}
              />
              <div className="notice" style={{ marginTop: 14 }}>
                <div className="cluster" style={{ gap: 16 }}>
                  <span>Gross: <strong className="mono">{money(totals.gross)}</strong></span>
                  <span>Concession: <strong className="mono" style={{ color: "var(--amber-text)" }}>{money(totals.concession)}</strong></span>
                  <span>Net Payable: <strong className="mono" style={{ color: "var(--green-text)" }}>{money(totals.net)}</strong></span>
                </div>
                <Button onClick={() => addUpsellToQuote({ product: "Enterprise Care Plan 2yr", category: "Subscription", price: 300, cap: 10 })}>
                  <Plus size={14} /> Add Care Plan
                </Button>
              </div>
            </Card>
            <div className="grid">
              <Card title="Quote-to-Cash Stepper">
                <Stepper active={quoteStage === "Draft" ? 0 : quoteStage === "Pending approval" || quoteStage === "Negotiation" ? 1 : quoteStage === "Invoiced" ? 3 : quoteStage === "Paid" ? 4 : 2} />
                <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                  <div className="cluster" style={{ justifyContent: "space-between" }}>
                    <span className="subtle">Draft State:</span>
                    <Badge tone="green">Ready</Badge>
                  </div>
                  <div className="cluster" style={{ justifyContent: "space-between" }}>
                    <span className="subtle">Manager Approval:</span>
                    <Badge tone={lines.some((line) => line.discount > line.cap) ? "red" : "green"}>{lines.some((line) => line.discount > line.cap) ? "Required" : "Not Required"}</Badge>
                  </div>
                  <div className="cluster" style={{ justifyContent: "space-between" }}>
                    <span className="subtle">Decision Status:</span>
                    <Badge tone={quoteStage === "Approved" ? "green" : "amber"}>{approvalDecision}</Badge>
                  </div>
                </div>
              </Card>
            </div>
          </div>
          <Card title="AI Recommended Upsells & Bundles" action={<Badge tone="blue"><Sparkles size={11} /> 3 Recommendations</Badge>}>
            <div className="grid grid-3">
              {[
                { name: "Precision Docking Station Gen 2", sub: "Compatible with Laptop Pro 14", price: "$180", product: "Precision Docking Station Gen 2", category: "Hardware", amount: 180, cap: 15 },
                { name: "Enterprise Care Plan 2yr", sub: "24/7 SLA & Rapid Replacement", price: "$300/mo", product: "Enterprise Care Plan 2yr", category: "Subscription", amount: 300, cap: 10 },
                { name: "Ergonomic Bluetooth Mouse", sub: "High attach rate with laptops", price: "$65", product: "Ergonomic Bluetooth Mouse", category: "Hardware", amount: 65, cap: 15 }
              ].map((rec) => (
                <div className="deal-card" key={rec.name}>
                  <div className="cluster" style={{ justifyContent: "space-between" }}>
                    <strong>{rec.name}</strong>
                    <span className="mono subtle">{rec.price}</span>
                  </div>
                  <span className="subtle">{rec.sub}</span>
                  <Button tone="ghost" onClick={() => addUpsellToQuote({ product: rec.product, category: rec.category, price: rec.amount, cap: rec.cap })}>
                    <Plus size={14} /> Add to Quote
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </>
  );
}
