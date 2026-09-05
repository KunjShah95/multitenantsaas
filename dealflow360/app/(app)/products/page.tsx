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

export default function ProductsPage() {
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
            eyebrow="Catalog Master"
            title="Product & Service Catalog"
            subtitle="Configure standard pricing, category rules, tax rates, and discount boundaries."
            actions={
              <>
                <Button tone="primary" onClick={() => navigate("product-detail")}><Plus size={15} /> New Product</Button>
                <Button onClick={() => navigate("discount-setup")}><SlidersHorizontal size={15} /> Discount Rules</Button>
              </>
            }
          />
          <div className="grid grid-3">
            <Metric title="Catalog Items" value="118 Active" detail="Across 14 categories" tone="blue" icon={<Tag size={14} />} onClick={() => navigate("product-detail")} />
            <Metric title="Pricelist Regions" value="3 Tiers" detail="USD, EUR, Global Enterprise" tone="green" icon={<Layers size={14} />} onClick={() => navigate("discount-setup")} />
            <Metric title="Configurable Bundles" value="42 Bundles" detail="Hardware + Care Attach" tone="amber" icon={<Box size={14} />} onClick={() => navigate("quote-builder")} />
          </div>
          <Card title="Products & Services Catalog">
            <DataTable
              headers={["Product Name", "Category", "Variants", "List Price", "Tax %", "Status", "Actions"]}
              rows={[
                ["Laptop Pro 14", "Hardware", "3 configurations", "$1,200", "15.0%", <Badge tone="green" key="s">Active</Badge>, <Button key="a" tone="primary" onClick={() => navigate("product-detail")}>Edit</Button>],
                ["Onsite Setup Service", "Services", "1 standard", "$450", "10.0%", <Badge tone="green" key="s">Active</Badge>, <Button key="a" onClick={() => navigate("product-detail")}>Edit</Button>],
                ["Enterprise Care Plan 2yr", "Subscription", "Monthly/Annual", "$300/mo", "0.0%", <Badge tone="blue" key="s">Active</Badge>, <Button key="a" onClick={() => navigate("billing-detail")}>Billing</Button>]
              ]}
            />
          </Card>
        </>
  );
}
