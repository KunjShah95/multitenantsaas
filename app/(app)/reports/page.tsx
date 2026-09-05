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

export default function ReportsPage() {
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
            eyebrow="Executive Analytics"
            title="Revenue & Performance Reports"
            subtitle="Key metrics on quote-to-cash turnaround, approval SLA velocity, and product performance."
            actions={
              <>
                <Button onClick={async () => { const { downloadReportPdf } = await import("../../lib/pdf"); downloadReportPdf({ period: "August 2026", kpis: [["Quotes generated", "26"], ["Avg approval SLA", "3.4 hrs"], ["Top volume driver", "Laptop Pro 14 ($72,400)"], ["Escalations in governance", "3"]], pipeline: [["Q-1042", "Acme Corp", money(totals.net)], ["Q-1039", "Beta Industries", "$18,200"], ["Q-1035", "Nova Retail", "$54,200"]] }); notify("Executive PDF report compiled", "success"); }}><Download size={15} /> Export PDF</Button>
                <Button onClick={() => { downloadCsv("dealflow-report.csv", ["Quote Reference", "Customer Account", "Stage Status", "Total Value"], [["Q-1042", "Acme Corp", quoteStage, totals.net], ["Q-1039", "Beta Industries", "Negotiation", 18200], ["Q-1035", "Nova Retail", "Confirmed", 54200]]); notify("CSV dataset downloaded", "success"); }}><FileSpreadsheet size={15} /> Export Sheet</Button>
              </>
            }
          />
          <div className="grid grid-4">
            <Metric title="Quotes Generated" value="26 Quotes" detail="Current fiscal month" tone="blue" trend="+18% MoM" onClick={() => navigate("quotations")} />
            <Metric title="Avg Approval SLA" value="3.4 Hours" detail="Down 12% from last month" tone="green" trend="Target < 6h" onClick={() => navigate("approvals")} />
            <Metric title="Top Volume Driver" value="Laptop Pro 14" detail="$72,400 active pipeline" tone="steel" onClick={() => navigate("products")} />
            <Metric title="Escalation Count" value="3 Flagged" detail="Currently in governance" tone="red" onClick={() => navigate("deal-health")} />
          </div>
        </>
  );
}
