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

export default function InvoicesPage() {
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
            eyebrow="Accounts Receivable"
            title="Invoices & Collections"
            subtitle="Track accounts receivable, automated reminders, and Stripe settlement statuses."
            actions={
              <>
                <Button tone="primary" onClick={generateInvoice}><Plus size={15} /> Generate Invoice</Button>
                <Button onClick={() => { downloadCsv("dealflow-invoices.csv", ["Invoice ID", "Account", "Billed Amount", "Payment Status", "Due Date"], [["INV-1042", "Acme Corp", totals.net, invoicePaid ? "Settled & Paid" : "Awaiting Settlement", "Sep 15, 2026"], ["INV-1039", "Beta Industries", 18200, "Overdue (3d)", "Aug 9, 2026"]]); notify("Invoices exported to CSV", "success"); }}><FileSpreadsheet size={15} /> Export Sheet</Button>
              </>
            }
          />
          <Card title="Accounts Receivable Ledger">
            <DataTable
              headers={["Invoice ID", "Account", "Billed Amount", "Payment Status", "Due Date", "Actions"]}
              rows={[
                [
                  <strong key="i">INV-1042</strong>,
                  "Acme Corp",
                  <span className="mono" key="m">{money(totals.net)}</span>,
                  <Badge tone={invoicePaid ? "green" : "amber"} key="s">
                    {invoicePaid ? <CheckCircle2 size={11} /> : <Clock size={11} />} {invoicePaid ? "Settled & Paid" : "Awaiting Settlement"}
                  </Badge>,
                  "Sep 15, 2026",
                  <Button key="a" tone="primary" onClick={() => navigate("invoice-detail")}>Inspect Invoice</Button>
                ],
                [
                  <strong key="i">INV-1039</strong>,
                  "Beta Industries",
                  <span className="mono" key="m">$18,200</span>,
                  <Badge tone="red" key="s"><AlertCircle size={11} /> Overdue (3d)</Badge>,
                  "Aug 9, 2026",
                  <Button key="a" onClick={() => notify("Automated payment reminder dispatched", "success")}>Send Reminder</Button>
                ]
              ]}
            />
          </Card>
        </>
  );
}
