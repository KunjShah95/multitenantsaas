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

export default function ProductDetailPage() {
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
            eyebrow="Catalog Item Editor"
            title="Product Definition: Laptop Pro 14"
            subtitle="Configure pricing tiers, tax classifications, inventory rules, and recurring billing."
            actions={
              <>
                <Button onClick={() => navigate("discount-setup")}>Discount Rules</Button>
                <Button tone="primary" onClick={() => { setProductStatus("Active"); notify("Product catalog changes committed", "success"); }}>
                  <Check size={15} /> Save Product
                </Button>
              </>
            }
          />
          <Card title="Product Master Parameters">
            <div className="form-grid">
              <label>Product Name<input defaultValue="Laptop Pro 14" /></label>
              <label>Category<input defaultValue="Hardware" /></label>
              <label>Base Price ($)<input defaultValue="1200" type="number" /></label>
              <label>Applicable Tax (%)<input defaultValue="15" type="number" /></label>
              <label>Recurring Subscription<select defaultValue="no"><option value="no">No (one-time purchase)</option><option value="yes">Yes (recurring plan)</option></select></label>
              <label>Available Stock on Hand<input defaultValue="42" type="number" /></label>
            </div>
            <div className="notice green" style={{ marginTop: 14 }}>
              <div className="cluster">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Product status: {productStatus}</span>
              </div>
              <Badge tone={productStatus === "Active" ? "green" : "amber"}>{productStatus}</Badge>
            </div>
          </Card>
        </>
  );
}
