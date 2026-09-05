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

export default function DiscountSetupPage() {
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
            eyebrow="Governance Configuration"
            title="Discount Tiers & Approval Thresholds"
            subtitle="Configure allowable discount caps by customer tier and set automated escalation paths."
            actions={<Button tone="primary" onClick={() => { setDiscountRulesSaved(true); notify("Discount governance policies saved", "success"); }}>Save Configuration</Button>}
          />
          <div className="split">
            <Card title="Discount Caps by Customer Tier">
              <DataTable
                headers={["Customer Tier", "Maximum Allowed Discount %"]}
                rows={[
                  ["Bronze Tier", <input key="i" defaultValue="5" type="number" aria-label="Bronze cap" />],
                  ["Silver Tier", <input key="i" defaultValue="10" type="number" aria-label="Silver cap" />],
                  ["Gold Enterprise Tier", <input key="i" defaultValue="15" type="number" aria-label="Gold cap" />]
                ]}
              />
            </Card>
            <Card title="Category Specific Discount Caps">
              <DataTable
                headers={["Category", "Category Cap %"]}
                rows={[
                  ["Hardware", <input key="i" defaultValue="15" type="number" aria-label="Hardware cap" />],
                  ["Services", <input key="i" defaultValue="10" type="number" aria-label="Services cap" />],
                  ["Subscription Care", <input key="i" defaultValue="10" type="number" aria-label="Subscription cap" />]
                ]}
              />
            </Card>
          </div>
          <Card title="Approval Escalation Authority Matrix">
            <DataTable
              headers={["Concession Severity", "Governance & Escalation Path"]}
              rows={[
                ["Within Tier & Category Cap", "Auto-Approved / Direct to Quote"],
                ["Exceeds Cap by < 5%", "Sales Team Lead Approval Required"],
                ["Exceeds Cap by > 5% or Service Concession", "Sales Operations Lead + Finance Director Approval"]
              ]}
            />
            <div className="notice" style={{ marginTop: 14 }}>
              <div className="cluster">
                <ShieldCheck size={16} aria-hidden="true" />
                <span>Configuration Status: {discountRulesSaved ? "Active & Enforced in Quote Builder" : "Pending Save"}</span>
              </div>
              <Badge tone={discountRulesSaved ? "green" : "amber"}>{discountRulesSaved ? "Enforced" : "Draft"}</Badge>
            </div>
          </Card>
        </>
  );
}
