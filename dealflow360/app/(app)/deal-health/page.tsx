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

export default function DealHealthPage() {
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
            eyebrow="AI Risk Radar"
            title="Deal Health & Anomaly Detector"
            subtitle="Automated detection of stalled negotiations, excessive margin concessions, and stock bottlenecks."
            actions={<Button tone="primary" onClick={() => notify("Account notifications dispatched to sales reps", "success")}><Send size={15} /> Ping Reps</Button>}
          />
          <div className="grid grid-3">
            <Metric title="Stalled / Gone Quiet" value="3 Deals" detail="No interaction > 14 days" tone="red" icon={<Clock size={14} />} onClick={() => navigate("customer-portal")} />
            <Metric title="Margin Erosion Risk" value="2 Deals" detail="Concessions > 15% limit" tone="amber" icon={<Percent size={14} />} onClick={() => navigate("approval-detail")} />
            <Metric title="Inventory Bottlenecks" value="1 Item" detail="Requires split dispatch" tone="blue" icon={<Warehouse size={14} />} onClick={() => navigate("fulfillment-detail")} />
          </div>
          <Card title="Prioritized Anomaly Worklist">
            <DataTable
              headers={["Deal Identifier", "Detected Risk Factor", "Sales Rep", "Remediation Action"]}
              rows={[
                ["Q-1042", "Concession over cap on Services (16%)", "M. Shah", <Button key="a" tone="primary" onClick={() => navigate("approval-detail")}>Resolve Gating</Button>],
                ["Q-1039", "No customer engagement in 14 days", "D. Kumar", <Button key="a" onClick={() => navigate("customer-portal")}>Open Portal</Button>],
                ["ORD-8021", "Docking Station shortage in primary warehouse", "East Depot", <Button key="a" onClick={() => navigate("fulfillment-detail")}>Execute Split</Button>]
              ]}
            />
          </Card>
        </>
  );
}
