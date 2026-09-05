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

export default function SubscriptionsPage() {
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
            eyebrow="Recurring Revenue Engine"
            title="Subscriptions & Care Plans"
            subtitle="Monitor recurring service contracts, MRR generation, and SLA renewal dates."
            actions={<Button tone="primary" onClick={() => navigate("billing-detail")}><Plus size={15} /> New Subscription Plan</Button>}
          />
          <Card title="Active Contracts & Service Plans">
            <DataTable
              headers={["Subscriber", "Service Plan", "Billing Cadence", "Next Renewal", "Contract State", "Action"]}
              rows={[
                [
                  <strong key="s">Acme Corp</strong>,
                  "Enterprise Care Plan 2yr",
                  "Monthly ($300/mo)",
                  "Sep 15, 2026",
                  <Badge tone={subscriptionActive ? "green" : "amber"} key="st">
                    {subscriptionActive ? "Active" : "Draft"}
                  </Badge>,
                  <Button key="a" tone="primary" onClick={() => navigate("billing-detail")}>Manage</Button>
                ],
                [
                  <strong key="s">Beta Industries</strong>,
                  "Support SLA Gold",
                  "Quarterly ($1,200/qtr)",
                  "Oct 1, 2026",
                  <Badge tone="green" key="st">Active</Badge>,
                  <Button key="a" onClick={() => navigate("billing-detail")}>Manage</Button>
                ],
                [
                  <strong key="s">Delta LLC</strong>,
                  "Cloud Infrastructure Retainer",
                  "Monthly ($500/mo)",
                  "Past Due",
                  <Badge tone="red" key="st">Payment Retry</Badge>,
                  <Button key="a" onClick={() => navigate("invoice-detail")}>View Invoice</Button>
                ]
              ]}
            />
          </Card>
        </>
  );
}
