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

export default function InvoiceDetailPage() {
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
            eyebrow="Billing Reconciliation"
            title="Invoice INV-1042: Acme Corp"
            subtitle="Review line-item billing, payment terms, and Stripe ERP settlement confirmation."
            actions={
              <>
                <Button onClick={async () => { const { downloadInvoicePdf } = await import("../../lib/pdf"); downloadInvoicePdf({ id: "INV-1042", account: "Acme Corp", due: "Sep 15, 2026", status: invoicePaid ? "Paid and reconciled" : "Open", lines }); notify("Official tax invoice PDF generated", "success"); }}><Download size={15} /> Save PDF</Button>
                <Button tone="success" disabled={invoicePaid} onClick={receivePayment}>
                  <CheckCircle2 size={15} /> {invoicePaid ? "Payment Settled" : "Receive Payment"}
                </Button>
              </>
            }
          />
          <Card title="Reconciliation Lifecycle">
            <Stepper active={invoicePaid ? 4 : 3} />
            <DataTable
              headers={["Invoice Reference", "Payable Total", "Current Status", "Payment Due"]}
              rows={[
                [
                  <strong key="i">INV-1042</strong>,
                  <span className="mono" key="m">{money(totals.net)}</span>,
                  <Badge tone={invoicePaid ? "green" : "amber"} key="s">
                    {invoicePaid ? "Paid & Reconciled" : "Open / Unpaid"}
                  </Badge>,
                  "Sep 15, 2026"
                ]
              ]}
            />
          </Card>
        </>
  );
}
