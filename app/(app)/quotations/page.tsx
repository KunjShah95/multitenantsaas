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

export default function QuotationsPage() {
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
            eyebrow="Pipeline Management"
            title="Quotations"
            subtitle="Manage enterprise draft quotes, approval gating, and active contract negotiations."
            actions={
              <>
                <div className="tabs" role="tablist" aria-label="Quotations view mode">
                  <Button tone={quoteView === "cards" ? "primary" : undefined} onClick={() => setQuoteView("cards")} tip="Kanban board grouped by stage" ariaLabel="Show kanban board">Kanban Stages</Button>
                  <Button tone={quoteView === "table" ? "primary" : undefined} onClick={() => setQuoteView("table")} tip="Flat register of every deal in the board" ariaLabel="Show data table">Data Table</Button>
                </div>
                <Button tone="primary" onClick={() => navigate("quote-builder")}><Plus size={15} /> New Quote</Button>
              </>
            }
          />
          {quoteView === "cards" ? (
            <div className="kanban" role="group" aria-label="Quotation kanban board by stage. Use Prev and Next buttons on cards to move deals.">
              {KANBAN_LANES.map((lane) => {
                const inLane = pipelineDeals.filter((deal) => deal.lane === lane);
                const laneTotal = inLane.reduce((s, d) => s + parseAmountToNumber(d.amount), 0);
                return (
                  <div
                    className="lane"
                    key={lane}
                    role="group"
                    aria-label={`${lane}: ${inLane.length} deals, ${money(laneTotal)} total`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = dragDealId.current ?? e.dataTransfer.getData("text/plain");
                      if (id) moveDeal(id, lane);
                      dragDealId.current = null;
                    }}
                  >
                    <div className="lane-header">
                      <strong>{lane}</strong>
                      <Badge tone={toneForKanbanLane(lane)}>{inLane.length}</Badge>
                    </div>
                    <div className="subtle mono" style={{ padding: "0 4px 2px" }}>{money(laneTotal)} in stage</div>
                    {inLane.length ? (
                      inLane.map((deal) => {
                        const idx = KANBAN_LANES.indexOf(deal.lane);
                        const prevLane = KANBAN_LANES[idx - 1];
                        const nextLane = KANBAN_LANES[idx + 1];
                        return (
                          <DealCard
                            key={deal.id}
                            name={deal.name}
                            id={deal.id}
                            amount={deal.amount}
                            owner={deal.owner}
                            live={deal.live}
                            tone={toneForKanbanLane(deal.lane)}
                            draggable
                            onDragStart={(e?: React.DragEvent) => {
                              dragDealId.current = deal.id;
                              try { e?.dataTransfer?.setData("text/plain", deal.id); } catch { /* drag payload best-effort */ }
                            }}
                            onOpen={() => navigate(deal.go)}
                            movePrev={prevLane ? () => moveDeal(deal.id, prevLane) : undefined}
                            moveNext={nextLane ? () => moveDeal(deal.id, nextLane) : undefined}
                            prevLabel={prevLane}
                            nextLabel={nextLane}
                          />
                        );
                      })
                    ) : (
                      <div className="lane-empty">No deals in this stage — drop a card here</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Card title={`Quotations Pipeline Register (${pipelineDeals.length} deals)`}>
              <DataTable
                headers={["Quote Reference", "Customer Account", "Stage Status", "Kanban Lane", "Sales Owner", "Total Value", "Action"]}
                rows={pipelineDeals.map((deal) => [
                  deal.id,
                  deal.name,
                  <Badge tone={toneForKanbanLane(deal.lane)} key="s">{deal.live ? quoteStage : deal.lane}</Badge>,
                  deal.lane,
                  deal.owner,
                  <span className="mono" key="m">{deal.amount}</span>,
                  <Button key="a" tone={deal.live ? "primary" : undefined} onClick={() => navigate(deal.go)}>{deal.live ? "Edit Quote" : "Open"}</Button>
                ])}
              />
            </Card>
          )}
        </>
  );
}
