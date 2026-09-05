"use client";

import { motion, MotionConfig, type Variants } from "framer-motion";
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
import { Badge, Button, Logo, ThemeToggle } from "./ui";
import type { Route, Theme } from "../lib/routes";
import { useStore } from "../lib/store";

const lpStagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const lpRise: Variants = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } } };
const lpView = { once: true, margin: "-70px" } as const;

function LandingPage({
  theme,
  onThemeChange,
  onGo
}: {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onGo: (r: Route, msg?: string) => void;
}) {
  const feats: { icon: React.ReactNode; title: string; body: string; cta: string; go: Route }[] = [
    { icon: <FileText size={16} aria-hidden="true" />, title: "Quote configurator", body: "Line items, quantities and tiered pricing in one sheet. Caps flagged per line before anything goes out.", cta: "Open Q-1042", go: "quote-builder" },
    { icon: <Percent size={16} aria-hidden="true" />, title: "Discount guardrails", body: "Bronze, Silver and Gold caps with category limits. Over-cap lines escalate instead of slipping through.", cta: "Set thresholds", go: "discount-setup" },
    { icon: <BadgeCheck size={16} aria-hidden="true" />, title: "Approval matrix", body: "Sales lead, finance director, warehouse. Each tier signs in order with SLA timers and a full audit trail.", cta: "Review queue", go: "approvals" },
    { icon: <Truck size={16} aria-hidden="true" />, title: "Split fulfillment", body: "Multi-warehouse allocation that routes around stockouts instead of backordering the whole deal.", cta: "See routing", go: "fulfillment" },
    { icon: <UserRound size={16} aria-hidden="true" />, title: "Customer counter-proposals", body: "Buyers review the same quote, request a discount or accept outright. Nothing lives in email threads.", cta: "Buyer view", go: "customer-portal" },
    { icon: <Receipt size={16} aria-hidden="true" />, title: "Billing and reconciliation", body: "Subscriptions bill on schedule, invoices settle through Stripe, and every payment reconciles.", cta: "Ledger", go: "invoices" }
  ];
  const steps: { n: string; title: string; body: string; go: Route; cta: string }[] = [
    { n: "01", title: "Quote it", body: "Build Q-1042 with live margin math.", go: "quote-builder", cta: "Configure" },
    { n: "02", title: "Approve it", body: "Clear the matrix in hours, not weeks.", go: "approvals", cta: "Approve" },
    { n: "03", title: "Ship it", body: "Split across warehouses, hit the date.", go: "fulfillment", cta: "Fulfill" },
    { n: "04", title: "Collect it", body: "Invoice, settle, reconcile. Done.", go: "invoices", cta: "Collect" }
  ];
  return (
    <MotionConfig reducedMotion="user">
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <button className="brand" onClick={() => onGo("landing")} type="button" aria-label="DealFlow 360 home">
            <Logo compact />
          </button>
          <nav className="lp-links" aria-label="Site sections">
            <button type="button" onClick={() => document.getElementById("product")?.scrollIntoView({ behavior: "smooth" })}>Product</button>
            <button type="button" onClick={() => document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth" })}>Workflow</button>
            <button type="button" onClick={() => document.getElementById("proof")?.scrollIntoView({ behavior: "smooth" })}>Results</button>
            <button type="button" onClick={() => document.getElementById("customers")?.scrollIntoView({ behavior: "smooth" })}>Customers</button>
          </nav>
          <div className="lp-nav-cta">
            <ThemeToggle theme={theme} onChange={onThemeChange} />
            <Button tone="ghost" onClick={() => onGo("signin")}>Sign in</Button>
            <Button tone="primary" onClick={() => onGo("dashboard", "Live demo workspace loaded")}>Open live demo <ArrowRight size={14} /></Button>
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <motion.div variants={lpStagger} initial="hidden" animate="show">
          <motion.p variants={lpRise} className="lp-kicker">Quote-to-cash workspace</motion.p>
          <motion.h1 variants={lpRise}>Every quote has a next step. <span className="u">Show it.</span></motion.h1>
          <motion.p variants={lpRise} className="lp-sub">DealFlow 360 carries each deal from draft to paid: discounts, approvals, stock, invoices, so sales ops always knows what is blocking what, and who signs next.</motion.p>
          <motion.div variants={lpRise} className="lp-cta-row">
            <Button tone="primary" onClick={() => onGo("dashboard", "Live demo workspace loaded")}>Open live demo <ArrowRight size={14} /></Button>
            <Button onClick={() => onGo("quote-builder")}>Inspect a real quote</Button>
          </motion.div>
          <motion.div variants={lpRise} className="lp-proof" id="proof">
            <div><b>26</b><span>Quotes this month</span></div>
            <div><b>3.4 hrs</b><span>Avg approval SLA</span></div>
            <div><b>88.4%</b><span>Margin protected</span></div>
            <div><b>$184.5k</b><span>Active pipeline</span></div>
          </motion.div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}>
          <div className="lp-shot" role="img" aria-label="Quotation Q-1042 for Acme Corp, approved, net payable $2,652">
            <div className="lp-stub" aria-hidden="true"><span>Q-1042 · ACME CORP · GOLD</span></div>
            <div className="lp-slip">
              <motion.div className="lp-stamp" initial={{ opacity: 0, scale: 1.7, rotate: -18 }} animate={{ opacity: 1, scale: 1, rotate: -7 }} transition={{ delay: 0.65, type: "spring", stiffness: 260, damping: 17 }}>Approved</motion.div>
              <div className="lp-slip-head">
                <div>
                  <strong>Quotation Q-1042</strong>
                  <span className="subtle">Acme Corp · Gold tier · Sep 2026</span>
                </div>
                <Badge tone="green"><CheckCircle2 size={11} /> Signed</Badge>
              </div>
              <div className="lp-slip-lines">
                <div><span>Laptop Pro 14 × 2 <span className="subtle">· 12% off</span></span><span className="mono">$2,112</span></div>
                <div><span>Onsite Setup × 1 <span className="subtle">· 16% off</span></span><span className="mono">$378</span></div>
                <div><span>Warranty 2-yr × 1 <span className="subtle">· 10% off</span></span><span className="mono">$162</span></div>
              </div>
              <div className="lp-total"><span className="subtle">Net payable</span><b>$2,652</b></div>
            </div>
          </div>
          <div className="lp-shot-cap">
            <Badge tone="blue"><span className="pulse-dot" /> Live demo data</Badge>
            <span className="subtle">Click through: every number below is interactive.</span>
          </div>
        </motion.div>
      </section>

      <motion.div className="lp-strip" id="customers" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={lpView} transition={{ duration: 0.5 }}>
        <div className="lp-strip-inner">
          <span>Running revenue for</span>
          <strong>Acme Corp</strong>
          <strong>Beta Industries</strong>
          <strong>Nova Retail</strong>
          <strong>Delta LLC</strong>
          <strong>East Depot</strong>
        </div>
      </motion.div>

      <section className="lp-section" id="product">
        <motion.div className="lp-section-head" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={lpView} transition={{ duration: 0.55, ease: "easeOut" }}>
          <p className="lp-kicker">Product</p>
          <h2>One workspace, six jobs done.</h2>
          <p className="subtle">Each module below opens live in the demo. No screenshots, no mock data theater.</p>
        </motion.div>
        <motion.div className="lp-grid" variants={lpStagger} initial="hidden" whileInView="show" viewport={lpView}>
          {feats.map((f) => (
            <motion.div key={f.title} variants={lpRise}>
              <div className="lp-feat">
                <span className="icon-tile">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
                <Button tone="ghost" onClick={() => onGo(f.go)}>{f.cta} <ArrowRight size={13} /></Button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="lp-section" id="workflow">
        <motion.div className="lp-section-head" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={lpView} transition={{ duration: 0.55, ease: "easeOut" }}>
          <p className="lp-kicker">Workflow</p>
          <h2>Draft to paid in four moves.</h2>
          <p className="subtle">The order matters: each step unlocks the next, and the audit trail follows the money.</p>
        </motion.div>
        <motion.div className="lp-steps" initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={lpView} transition={{ duration: 0.6, ease: "easeOut" }}>
          {steps.map((s) => (
            <div className="lp-step" key={s.n}>
              <span className="lp-step-num">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <Button tone="ghost" onClick={() => onGo(s.go)}>{s.cta} <ArrowRight size={13} /></Button>
            </div>
          ))}
        </motion.div>
      </section>

      <section className="lp-band">
        <motion.div className="lp-band-inner" initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={lpView} transition={{ duration: 0.6, ease: "easeOut" }}>
          <div>
            <h2>Run your next quote through DealFlow 360.</h2>
            <p>18 working views, one pipeline, zero spreadsheet archaeology. Start with Q-1042.</p>
          </div>
          <div className="cluster">
            <Button tone="primary" onClick={() => onGo("dashboard", "Live demo workspace loaded")}>Open live demo <ArrowRight size={14} /></Button>
            <Button onClick={() => onGo("reports")}>See the reports</Button>
          </div>
        </motion.div>
      </section>

      <footer className="lp-footer">
        <div>
          <Logo compact />
          <p className="subtle" style={{ marginTop: 8, maxWidth: 300 }}>Quote-to-cash workspace for sales ops and finance. Prototype build for hackathon evaluation.</p>
        </div>
        <nav aria-label="Footer">
          <div>
            <span className="section-label">Sell</span>
            <button onClick={() => onGo("quotations")} type="button">Quotations</button>
            <button onClick={() => onGo("customer-portal")} type="button">Customer portal</button>
            <button onClick={() => onGo("deal-health")} type="button">Deal health</button>
          </div>
          <div>
            <span className="section-label">Operate</span>
            <button onClick={() => onGo("approvals")} type="button">Approvals</button>
            <button onClick={() => onGo("fulfillment")} type="button">Fulfillment</button>
            <button onClick={() => onGo("subscriptions")} type="button">Subscriptions</button>
          </div>
          <div>
            <span className="section-label">Account</span>
            <button onClick={() => onGo("signin")} type="button">Sign in</button>
            <button onClick={() => onGo("register")} type="button">Create account</button>
            <button onClick={() => onGo("dashboard")} type="button">Live demo</button>
            <button onClick={() => onGo("reports")} type="button">Reports</button>
          </div>
        </nav>
      </footer>
    </MotionConfig>
  );
}

export function Landing() {
  const { theme, setTheme, navigate } = useStore();
  return <LandingPage theme={theme} onThemeChange={setTheme} onGo={(r, msg) => navigate(r, msg, "info")} />;
}