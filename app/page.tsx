"use client";

import { Landing } from "./components/landing";
import { Toasts } from "./components/ui";

export default function HomePage() {
  return (
    <div className="lp" data-current-route="landing">
      <Landing />
      <Toasts />
    </div>
  );
}
