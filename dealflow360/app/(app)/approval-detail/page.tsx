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

export default function ApprovalDetailPage() {
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
            eyebrow="Audit & Verification"
            title="Approval Review: Quote Q-1042"
            subtitle="Verify discount thresholds, margin impact, and sign-off hierarchy for Acme Corp."
            actions={
              <>
                <Button tone="success" onClick={approveQuote}><Check size={15} aria-hidden="true" /> Approve</Button>
                <Button onClick={returnQuote}><RotateCcw size={15} /> Return for Reason</Button>
                <Button tone="danger" onClick={() => { setApprovalDecision("Rejected"); notify("Q-1042 rejected by approver", "error"); }}><X size={15} aria-hidden="true" /> Reject</Button>
              </>
            }
          />
          <div className="grid">
            <Card title="Line Item Concession Breakdown">
              <DataTable
                headers={["Line Item", "Concession Applied", "Maximum Allowed Cap", "Authorized Escalation Role"]}
                rows={[
                  ["Laptop Pro 14", "12.0%", "15.0%", <Badge tone="green" key="1">Sales Ops</Badge>],
                  ["Onsite Setup Service", "16.0%", "10.0%", <Badge tone="red" key="2">Finance Director</Badge>],
                  ["Extended Warranty 2-Year", "10.0%", "10.0%", <Badge tone="blue" key="3">Auto Compliant</Badge>]
                ]}
              />
              <div className="notice red" style={{ marginTop: 14 }}>
                <div className="cluster">
                  <ShieldAlert size={16} aria-hidden="true" />
                  <span>Onsite Setup Service discount exceeds standard policy by 6.0%. Requires Finance Director override.</span>
                </div>
                <Badge tone="red">{approvalDecision}</Badge>
              </div>
            </Card>
            <Card title="Approval Hierarchy & Audit History">
              <Stepper active={quoteStage === "Approved" ? 2 : 1} />
              <DataTable
                headers={["Approval Tier", "Approver Identity", "Timestamp", "Audit Notes"]}
                rows={[
                  ["Sales Ops Lead", "Sarah Jenkins", "Aug 29, 2:40 PM", "Approved under Gold Account Program"],
                  ["Finance Director", "Naveen Kapoor", "Awaiting Review", "Evaluating margin impact on professional services"],
                  ["Warehouse Fulfillment", "East Depot Logistics", "Pending Sign-off", "Pre-allocation staged in warehouse"]
                ]}
              />
            </Card>
          </div>
        </>
  );
}
