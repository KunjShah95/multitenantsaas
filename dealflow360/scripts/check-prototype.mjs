import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = new URL("../app/", import.meta.url);

function collectFiles(dirPath) {
  const out = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (/\.(tsx?|css)$/.test(entry.name)) out.push(readFileSync(full, "utf8"));
  }
  return out;
}

const sources = collectFiles(fileURLToPath(appDir));
const source = sources.join("\n");
const css = sources.join("\n");

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

console.log(`Prototype audit passed: ${requiredRoutes.length} routes and ${requiredInteractions.length} critical interactions covered across ${sources.length} app files.`);
