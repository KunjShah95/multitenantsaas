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

export default function CustomerPortalPage() {
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
          <div className="portal-bar">
            <div className="cluster">
              <UserRound size={16} aria-hidden="true" />
              <strong>Customer Negotiation View: Q-1042</strong>
              <Badge tone="amber">Awaiting Customer Decision</Badge>
            </div>
            <div className="cluster">
              <span className="subtle">Viewing as Dave (Acme Corp Procurement)</span>
              <Button onClick={() => navigate("quote-builder")}>Switch to Rep View</Button>
            </div>
          </div>
          <PageHead
            eyebrow="Interactive Customer Review"
            title="Quotation Q-1042 (Proposal Summary)"
            subtitle="Review discounted enterprise pricing or submit a counter proposal for review."
            actions={<Button tone="primary" onClick={async () => { const { downloadQuotePdf } = await import("../../lib/pdf"); downloadQuotePdf({ id: "Q-1042", account: "Acme Corp", tier: "Gold Tier", date: "Sep 5, 2026", lines }); notify("PDF quotation downloaded", "success"); }}><Download size={15} /> Download PDF</Button>}
          />
          <div className="split">
            <Card title="Current Proposal Items">
              <DataTable
                headers={["Item Description", "Qty", "List Price", "Discount %", "Net Total"]}
                rows={lines.map((line) => [
                  line.product,
                  line.qty,
                  money(line.price),
                  percent(line.discount),
                  <strong className="mono" key="n">{money(line.qty * line.price * (1 - line.discount / 100))}</strong>
                ])}
              />
            </Card>
            <Card title="Submit Counter Proposal">
              <form
                className="grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  setQuoteStage("Negotiation");
                  setApprovalDecision("Counter proposal under finance review");
                  notify(`Counter proposal submitted for ${counterDiscount}% discount`, "info");
                }}
              >
                <label>
                  Requested Discount %
                  <input onChange={(event) => setCounterDiscount(event.target.value)} value={counterDiscount} />
                </label>
                <label>
                  Desired Delivery Date
                  <input defaultValue="2026-09-12" type="date" />
                </label>
                <label>
                  Procurement Notes
                  <textarea defaultValue="Can we bundle the Docking Station at $80 and sign this week?" rows={3} />
                </label>
                <Button tone="primary" type="submit">Submit Counter Proposal</Button>
                <Button tone="success" onClick={() => { setQuoteStage("Approved"); setApprovalDecision("Approved by customer; ready for fulfillment"); notify("Customer accepted quote. Ready for fulfillment.", "success"); }}>
                  <Check size={15} /> Accept This Quote
                </Button>
              </form>
            </Card>
          </div>
        </>
  );
}
