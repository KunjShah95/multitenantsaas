"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "../components/shell";
import { DemoTour, FlowAudit, Toasts } from "../components/ui";
import type { Route } from "../lib/routes";
import { useStore } from "../lib/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { navigate, theme, setTheme, quoteStage, resetDemo } = useStore();
  const pathname = usePathname();
  const segment = (pathname ?? "/").replace(/^\//, "").split("/")[0] || "dashboard";
  const route = segment as Route;
  return (
    <AppShell route={route} setRoute={navigate} theme={theme} onThemeChange={setTheme}>
      {children}
      <FlowAudit route={route} />
      <DemoTour route={route} quoteStage={quoteStage} onNavigate={navigate} onReset={resetDemo} />
      <Toasts />
    </AppShell>
  );
}
