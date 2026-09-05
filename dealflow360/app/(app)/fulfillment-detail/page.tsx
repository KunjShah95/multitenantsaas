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

export default function FulfillmentDetailPage() {
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
            eyebrow="Smart Inventory Routing"
            title="Fulfillment Routing: Q-1042"
            subtitle="Multi-warehouse split allocation for Acme Corp to prevent backorders and meet SLA."
            actions={
              <>
                <Button tone="primary" onClick={acceptSplit}><PackageCheck size={15} /> Accept Suggested Split</Button>
                <Button onClick={() => notify("Manual routing editor opened", "info")}>Manual Allocation</Button>
              </>
            }
          />
          <Card title="Recommended Split Allocation">
            <DataTable
              headers={["Fulfillment Center", "Assigned Products", "Package Count", "Carrier Logistics Cost"]}
              rows={[
                ["Main Warehouse (Chicago)", "Laptop Pro 14 x2", "1 Box", "$42.00"],
                ["East Depot (New York)", "Docking Station Fallback x1", "1 Box", "$18.00"],
                ["Digital Delivery Hub", "Enterprise Care Plan 2yr", "Instant Provision", "$0.00"]
              ]}
            />
            <div className="notice green" style={{ marginTop: 14 }}>
              <div className="cluster">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Split routing satisfies delivery date (Sep 12) without incurring out-of-stock delays.</span>
              </div>
              <Badge tone={fulfillmentAccepted ? "green" : "amber"}>{fulfillmentAccepted ? "Split Active" : "Pending Acceptance"}</Badge>
            </div>
          </Card>
        </>
  );
}
