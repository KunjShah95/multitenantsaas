"use client";

import type { ReactNode } from "react";
import { DealFlowProvider } from "./lib/store";

export function Providers({ children }: { children: ReactNode }) {
  return <DealFlowProvider>{children}</DealFlowProvider>;
}
