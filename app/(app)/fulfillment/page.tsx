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

export default function FulfillmentPage() {
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
            eyebrow="Logistics & Warehousing"
            title="Fulfillment & Stock Overview"
            subtitle="Multi-warehouse inventory allocation, split shipment rules, and packing slips."
            actions={<Button tone="primary" onClick={() => notify("Realtime inventory refreshed from ERP", "success")}><RefreshCw size={15} /> Refresh Stock</Button>}
          />
          <div className="grid grid-3">
            <Metric title="Central Warehouse" value="88% Cap" detail="Capacity utilized (Optimal)" tone="amber" icon={<Warehouse size={14} />} meter={{ pct: 88, tone: "warn" }} />
            <Metric title="Pending Shipments" value="7 Orders" detail="$162,400 total value staged" tone="blue" icon={<Truck size={14} />} />
            <Metric title="Split Required" value="1 Item" detail="Docking Station inventory fallback" tone="red" icon={<AlertTriangle size={14} />} />
          </div>
          <Card title="Staged Orders Ready for Dispatch">
            <DataTable
              headers={["Order Ref", "Customer Account", "Item Manifest", "Dispatch Origin", "Status", "Action"]}
              rows={[
                [
                  <strong key="o">Q-1042 / ORD-8021</strong>,
                  "Acme Corp",
                  "2x Laptop, 1x Setup, 1x Care Plan",
                  "Main Warehouse + East Depot",
                  <Badge tone={fulfillmentAccepted ? "green" : "amber"} key="s">
                    {fulfillmentAccepted ? <PackageCheck size={11} /> : <Clock size={11} />} {fulfillmentAccepted ? "Split Allocated" : "Awaiting Split"}
                  </Badge>,
                  <Button key="a" tone="primary" onClick={() => navigate("fulfillment-detail")}>Open Split</Button>
                ],
                [
                  <strong key="o">Q-1038 / ORD-8019</strong>,
                  "Delta LLC",
                  "10x Laptop Pro 14",
                  "Main Warehouse",
                  <Badge tone="green" key="s"><CheckCircle2 size={11} /> Ready</Badge>,
                  <Button key="a" onClick={() => notify("Pick slip sent to thermal printer", "success")}>Print Pick Slip</Button>
                ],
                [
                  <strong key="o">Q-1035 / ORD-8014</strong>,
                  "Nova Retail",
                  "5x Docking Station, 5x Mouse",
                  "East Coast Depot",
                  <Badge tone="blue" key="s"><Truck size={11} /> In Transit</Badge>,
                  <Button key="a" onClick={() => notify("Carrier tracking live window opened", "info")}>Track Shipment</Button>
                ]
              ]}
            />
          </Card>
        </>
  );
}
