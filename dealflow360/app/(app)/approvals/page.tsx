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

export default function ApprovalsPage() {
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
            eyebrow="Governance & Risk Matrix"
            title="Discount & Concession Approvals"
            subtitle="Quotes exceeding rep discount limits requiring management and finance sign-off."
            actions={
              <div className="tabs">
                {["All", "Pending", "Returned", "Approved"].map((filter) => (
                  <Button key={filter} tone={approvalFilter === filter ? "primary" : undefined} onClick={() => setApprovalFilter(filter)}>
                    {filter}
                  </Button>
                ))}
              </div>
            }
          />
          <div className="grid grid-3">
            <Metric title="Pending Sign-Off" value="$117,800" detail="4 quotes awaiting review" tone="amber" icon={<Clock size={14} />} />
            <Metric title="Average SLA Response" value="3.4 hrs" detail="Target SLA: under 6.0 hrs" tone="green" icon={<CheckCircle2 size={14} />} />
            <Metric title="Primary Exception" value="Service Discount" detail="Setup Services > 10% Cap" tone="red" icon={<AlertTriangle size={14} />} />
          </div>
          <Card
            title={`${approvalFilter} Approvals Queue`}
            action={
              <Button tone="primary" onClick={approveQuote}>
                <Check size={15} aria-hidden="true" /> Approve All
              </Button>
            }
          >
            {(() => {
              const q1042Status = returnedQuotes.includes("Q-1042") ? "Returned" : quoteStage === "Approved" || quoteStage === "Fulfillment" || quoteStage === "Subscribed" || quoteStage === "Invoiced" || quoteStage === "Paid" ? "Approved" : "Pending";
              const all: { id: string; row: React.ReactNode[]; status: string }[] = [
                {
                  id: "Q-1042",
                  status: q1042Status,
                  row: [
                    <strong key="q">Q-1042</strong>,
                    "Acme Corp",
                    <Badge tone="red" key="r">Major Deal</Badge>,
                    "Sales Ops + Finance Director",
                    <span className="mono" key="w">$42,400</span>,
                    "M. Shah / Sarah J.",
                    <Badge tone="amber" key="t">1h left</Badge>,
                    <Button key="a" tone="primary" onClick={() => navigate("approval-detail")}>Open Review <ArrowRight size={14} aria-hidden="true" /></Button>
                  ]
                },
                {
                  id: "Q-1039",
                  status: "Pending",
                  row: [
                    <strong key="q">Q-1039</strong>,
                    "Beta Industries",
                    <Badge tone="amber" key="r">Mid Tier</Badge>,
                    "Sales Team Lead",
                    <span className="mono" key="w">$18,200</span>,
                    "David K.",
                    <Badge tone="neutral" key="t">3h left</Badge>,
                    <Button key="a" onClick={() => navigate("approval-detail")}>Open Review <ArrowRight size={14} aria-hidden="true" /></Button>
                  ]
                },
                {
                  id: "Q-1044",
                  status: "Approved",
                  row: [
                    <strong key="q">Q-1044</strong>,
                    "Nova Retail",
                    <Badge tone="green" key="r">Standard</Badge>,
                    "Auto Gating",
                    <span className="mono" key="w">$5,100</span>,
                    "Liam P.",
                    <Badge tone="green" key="t">Approved</Badge>,
                    <Button key="a" onClick={() => notify("Small quote approved via automated rules", "success")}>OK</Button>
                  ]
                }
              ];
              const shown = approvalFilter === "All" ? all : all.filter((r) => r.status === approvalFilter);
              if (!shown.length) {
                return (
                  <Empty
                    icon={<Inbox size={32} aria-hidden="true" />}
                    title={`No ${approvalFilter.toLowerCase()} approval requests`}
                    hint="All items in this queue have been processed or resolved."
                    action={<Button onClick={() => setApprovalFilter("All")}>Show All Requests</Button>}
                  />
                );
              }
              return (
                <DataTable
                  headers={["Quote ID", "Account Name", "Deal Category", "Required Approvers", "Contract Value", "Deal Owner", "SLA Status", "Actions"]}
                  rows={shown.map((r) => r.row)}
                />
              );
            })()}
          </Card>
        </>
  );
}
