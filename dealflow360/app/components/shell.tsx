"use client";

import { useEffect, useRef, useState } from "react";
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
import { Badge, Button, Logo, NavIcon, ThemeToggle, sideGroups } from "./ui";
import { flowRoutes, routeNames, type Route, type Theme, type ToastKind } from "../lib/routes";

export function AppShell({
  route,
  setRoute,
  children,
  theme,
  onThemeChange
}: {
  route: Route;
  setRoute: (route: Route, message?: string, kind?: ToastKind) => void;
  children: React.ReactNode;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
}) {
  const activeTop = route === "quote-builder" ? "quotations" : route === "approval-detail" ? "approvals" : route === "fulfillment-detail" ? "fulfillment" : route === "billing-detail" ? "subscriptions" : route === "invoice-detail" ? "invoices" : route === "product-detail" || route === "discount-setup" ? "products" : route;
  const activeItem = sideGroups.flatMap((g) => g.items).find((i) => i.route === activeTop);
  const groupOf = (r: string) => (sideGroups[0].items.some((i) => i.route === r) ? sideGroups[0].title : sideGroups[1].title);
  
  const [workspace, setWorkspace] = useState("Acme Corp (NA-OPS)");
  const [isSyncing, setIsSyncing] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wsRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const workspaces = ["Acme Corp (NA-OPS)", "Beta Industries (EMEA)", "Nova Retail (Global)"];

  const searchIndex: { label: string; sub: string; kind: string; route: Route; keys: string }[] = [
    { label: "Q-1042 · Acme Corp", sub: "$42,400 · Pending approval", kind: "Quote", route: "quote-builder", keys: "q1042 acme quote laptop" },
    { label: "Q-1039 · Beta Industries", sub: "$18,200 · Negotiation", kind: "Quote", route: "customer-portal", keys: "q1039 beta quote negotiation" },
    { label: "Q-1035 · Nova Retail", sub: "$54,200 · Confirmed", kind: "Quote", route: "fulfillment", keys: "q1035 nova quote retail" },
    { label: "Q-1044 · Nova Retail", sub: "$5,100 · Auto-approved", kind: "Quote", route: "approvals", keys: "q1044 nova quote" },
    { label: "INV-1042 · Acme Corp", sub: "Due Sep 15, 2026", kind: "Invoice", route: "invoice-detail", keys: "inv1042 invoice acme billing" },
    { label: "INV-1039 · Beta Industries", sub: "Overdue · $18,200", kind: "Invoice", route: "invoices", keys: "inv1039 invoice beta overdue" },
    { label: "ORD-8021 · Acme Corp", sub: "Split fulfillment · Main + East", kind: "Order", route: "fulfillment-detail", keys: "ord8021 order shipment fulfillment acme" },
    { label: "ORD-8019 · Delta LLC", sub: "Ready to dispatch", kind: "Order", route: "fulfillment", keys: "ord8019 order delta" },
    { label: "Dashboard", sub: "Revenue command center", kind: "Page", route: "dashboard", keys: "dashboard home overview pipeline" },
    { label: "Quotations", sub: "Pipeline management", kind: "Page", route: "quotations", keys: "quotations quotes pipeline" },
    { label: "Approvals", sub: "Discount governance queue", kind: "Page", route: "approvals", keys: "approvals governance signoff" },
    { label: "Fulfillment", sub: "Stock and dispatch", kind: "Page", route: "fulfillment", keys: "fulfillment stock warehouse dispatch" },
    { label: "Subscriptions", sub: "Recurring revenue", kind: "Page", route: "subscriptions", keys: "subscriptions recurring care plan" },
    { label: "Invoices", sub: "Accounts receivable", kind: "Page", route: "invoices", keys: "invoices billing receivable" },
    { label: "Deal Health", sub: "Risk radar and anomalies", kind: "Page", route: "deal-health", keys: "deal health risk anomaly" },
    { label: "Reports", sub: "Executive analytics", kind: "Page", route: "reports", keys: "reports analytics executive" },
    { label: "Products", sub: "Catalog master", kind: "Page", route: "products", keys: "products catalog pricelist" },
    { label: "Discount Setup", sub: "Tier caps and thresholds", kind: "Page", route: "discount-setup", keys: "discount setup caps thresholds tiers" }
  ];

  const results = query.trim()
    ? searchIndex
        .filter((item) => `${item.label} ${item.sub} ${item.keys}`.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 7)
    : [];

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) setWsOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setWsOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const pickWorkspace = (name: string) => {
    setWorkspace(name);
    setWsOpen(false);
    setRoute(route, `Workspace switched to ${name}`, "info");
  };

  const goResult = (target: Route) => {
    setSearchOpen(false);
    setQuery("");
    setActiveIdx(0);
    setRoute(target);
  };

  const triggerSync = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setRoute(route, "Syncing ERP records with SAP / NetSuite...", "info");
    setTimeout(() => {
      setIsSyncing(false);
      setRoute(route, "ERP sync complete • 4,820 SKU records live", "success");
    }, 900);
  };

  const handleSignOut = () => {
    setRoute("signin", "Signed out of DealFlow360", "info");
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="cluster">
          <button className="brand" onClick={() => setRoute("dashboard")} type="button" aria-label="DealFlow 360 home">
            <Logo compact />
          </button>
          <span className="crumb" aria-label="Breadcrumb location">
            {groupOf(activeTop)} <span className="crumb-sep">/</span> <strong>{activeItem?.label ?? routeNames[route]}</strong>
          </span>
        </div>
        <div className="topbar-right">
          <div className="search-wrap" ref={searchRef}>
            <label className="topbar-search" aria-label="Global search">
              <Search size={13} aria-hidden="true" />
              <input
                placeholder="Search quotes, invoices, accounts..."
                aria-label="Search quotes, invoices, accounts"
                role="combobox"
                aria-autocomplete="list"
                aria-activedescendant={results.length && searchOpen ? `search-opt-${activeIdx}` : undefined}
                ref={searchInputRef}
                aria-expanded={searchOpen && results.length > 0}
                aria-controls="global-search-results"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); setActiveIdx(0); }}
                onFocus={() => { if (query.trim()) setSearchOpen(true); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" && results.length) { e.preventDefault(); setSearchOpen(true); setActiveIdx((i) => (i + 1) % results.length); }
                  else if (e.key === "ArrowUp" && results.length) { e.preventDefault(); setActiveIdx((i) => (i - 1 + results.length) % results.length); }
                  else if (e.key === "Enter" && results.length) { e.preventDefault(); goResult(results[Math.min(activeIdx, results.length - 1)].route); }
                  else if (e.key === "Escape") { setSearchOpen(false); }
                }}
              />
              <kbd>⌘K</kbd>
            </label>
            {searchOpen && query.trim() ? (
              <div className="search-menu" id="global-search-results" role="listbox" aria-label="Search results">
                {results.length === 0 ? (
                  <div className="search-empty">
                    <strong>No matches for “{query.trim()}”</strong>
                    <div className="subtle">Try a quote ID, account name, or page.</div>
                  </div>
                ) : (
                  <>
                    <div className="menu-label">{results.length} result{results.length === 1 ? "" : "s"}</div>
                    {results.map((item, i) => (
                      <button
                        key={`${item.kind}-${item.label}`}
                        id={`search-opt-${i}`}
                        type="button"
                        role="option"
                        aria-selected={i === activeIdx}
                        className={`search-item ${i === activeIdx ? "selected" : ""}`}
                        onMouseEnter={() => setActiveIdx(i)}
                        onClick={() => goResult(item.route)}
                      >
                        <span className="search-kind">{item.kind}</span>
                        <span>
                          <strong>{item.label}</strong>
                          <span className="subtle">{item.sub}</span>
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            ) : null}
          </div>
          <div className="menu-wrap" ref={wsRef}>
            <button
              className="badge blue topbar-action-pill"
              onClick={() => setWsOpen((o) => !o)}
              type="button"
              aria-haspopup="menu"
              aria-expanded={wsOpen}
              aria-label={`Workspace: ${workspace}. Open workspace menu.`}
            >
              <Building2 size={12} aria-hidden="true" />
              <span>{workspace}</span>
              <ChevronDown size={11} aria-hidden="true" />
            </button>
            {wsOpen ? (
              <div className="menu" role="menu" aria-label="Switch workspace">
                <div className="menu-label">Switch workspace</div>
                {workspaces.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="menuitemradio"
                    aria-checked={name === workspace}
                    className={`menu-item ${name === workspace ? "active" : ""}`}
                    onClick={() => pickWorkspace(name)}
                  >
                    <Building2 size={13} aria-hidden="true" />
                    <span>{name}</span>
                    <Check size={13} className="tick" aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            className="badge green topbar-action-pill"
            onClick={triggerSync}
            type="button"
            data-tip="Click to Refresh ERP Sync"
            aria-label="Synchronize ERP database"
          >
            {isSyncing ? <RefreshCw size={11} className="spin" aria-hidden="true" /> : <span className="pulse-dot" aria-hidden="true" />}
            <span>{isSyncing ? "Syncing..." : "Realtime ERP"}</span>
          </button>
          <button className="icon-button" type="button" aria-label="Notifications, 3 unread" data-tip="3 unread alerts" onClick={() => setRoute("deal-health", "3 anomalies need attention", "info")}>
            <Inbox size={15} aria-hidden="true" />
          </button>
          <ThemeToggle theme={theme} onChange={onThemeChange} />
          <button
            className="avatar-btn"
            onClick={handleSignOut}
            data-tip="Alex Chen (Click to Sign Out)"
            aria-label="User profile: Alex Chen. Click to sign out."
            type="button"
          >
            <span className="avatar">AC</span>
          </button>
        </div>
      </header>
      <div className="shell">
        <aside className="sidebar">
          <nav className="side-nav" aria-label="Primary navigation">
            {sideGroups.map((group) => (
              <div key={group.title}>
                <div className="side-title">{group.title}</div>
                {group.items.map((item) => (
                  <button
                    className={`side-link ${activeTop === item.route ? "active" : ""}`}
                    data-route={item.route}
                    aria-current={activeTop === item.route ? "page" : undefined}
                    key={item.route}
                    onClick={() => setRoute(item.route)}
                    type="button"
                  >
                    <span className="side-icon"><NavIcon route={item.route} /></span>
                    <span className="side-label">{item.label}</span>
                    {item.count ? <span className="side-count">{item.count}</span> : null}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="side-foot">
            <div className="upgrade-card">
              <div className="cluster" style={{ justifyContent: "space-between" }}>
                <Badge tone="steel"><Sparkles size={11} /> Q3 Close</Badge>
                <span className="mono subtle">82%</span>
              </div>
              <strong style={{ display: "block", margin: "8px 0 3px" }}>$184.5k in active pipeline</strong>
              <span className="subtle">4 approvals blocking $117.8k. Clear them before Sep 12.</span>
              <div className="progress-thin" style={{ marginTop: 10 }}><span style={{ width: "82%" }} /></div>
              <div style={{ marginTop: 10 }}>
                <Button tone="primary" testId="side-review" ariaLabel="Review blocking approvals" onClick={() => setRoute("approvals")}><BadgeCheck size={13} /> Review blockers</Button>
              </div>
            </div>
            <button
              className="side-user-btn"
              onClick={handleSignOut}
              type="button"
              data-tip="Click to Sign Out"
              aria-label="Alex Chen (Sales Ops Lead). Click to sign out."
            >
              <span className="avatar" title="Alex Chen">AC</span>
              <div>
                <strong>Alex Chen</strong>
                <span className="subtle">Sales Ops Lead • Sign out</span>
              </div>
            </button>
          </div>
        </aside>
        <main className="main" data-current-route={route} id="main" tabIndex={-1}>
          <div className="page">{children}</div>
        </main>
      </div>
    </div>
  );
}
