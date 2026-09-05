import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const requiredRoutes = [
  "login",
  "dashboard",
  "quotations",
  "quote-builder",
  "approvals",
  "approval-detail",
  "fulfillment",
  "fulfillment-detail",
  "subscriptions",
  "billing-detail",
  "customer-portal",
  "invoices",
  "invoice-detail",
  "deal-health",
  "reports",
  "products",
  "product-detail",
  "discount-setup"
];

const requiredInteractions = [
  "submitQuote",
  "approveQuote",
  "acceptSplit",
  "generateInvoice",
  "receivePayment",
  "Submit Counter Proposal",
  "Save Configuration",
  "New Product"
];

const blockedArtifacts = ["â€¢", "â€“", "â€”", "âŒ˜"];

const failures = [];

for (const route of requiredRoutes) {
  if (!source.includes(`"${route}"`)) {
    failures.push(`Missing route: ${route}`);
  }
}

for (const interaction of requiredInteractions) {
  if (!source.includes(interaction)) {
    failures.push(`Missing interaction: ${interaction}`);
  }
}

for (const artifact of blockedArtifacts) {
  if (source.includes(artifact) || css.includes(artifact)) {
    failures.push(`Encoding artifact found: ${artifact}`);
  }
}

if (!source.includes("data-prototype-flow={flowRoutes.join")) {
  failures.push("Prototype flow coverage marker missing");
}

if (failures.length) {
  console.error("Prototype audit failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Prototype audit passed: ${requiredRoutes.length} routes and ${requiredInteractions.length} critical interactions covered.`);
