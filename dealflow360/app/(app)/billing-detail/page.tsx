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

export default function BillingDetailPage() {
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
            eyebrow="Contract Billing"
            title="Billing Schedule: Acme Care Plan 2yr"
            subtitle="Automated subscription billing schedule, recurring terms, and invoice generation."
            actions={
              <>
                <Button onClick={() => { setSubscriptionActive(true); notify("Subscription terms updated", "success"); }}>Update Plan</Button>
                <Button tone="danger" onClick={() => notify("Cancellation queue triggered", "error")}>Cancel Plan</Button>
                <Button tone="primary" onClick={generateInvoice}><Receipt size={15} /> Generate Invoice</Button>
              </>
            }
          />
          <Card title="Recurring Line Items & Schedule">
            <DataTable
              headers={["Service Line", "Quantity", "Recurring Rate", "Cadence"]}
              rows={[
                ["Enterprise Care Plan 2yr", "1", "$300.00", "Monthly"],
                ["Priority Engineer SLA", "1", "$150.00", "Monthly"]
              ]}
            />
          </Card>
        </>
  );
}
