export type Route =
  | "landing"
  | "login"
  | "signin"
  | "register"
  | "forgot-password"
  | "dashboard"
  | "quotations"
  | "quote-builder"
  | "approvals"
  | "approval-detail"
  | "fulfillment"
  | "fulfillment-detail"
  | "subscriptions"
  | "billing-detail"
  | "customer-portal"
  | "invoices"
  | "invoice-detail"
  | "deal-health"
  | "reports"
  | "products"
  | "product-detail"
  | "discount-setup";

export type StatusTone = "green" | "amber" | "red" | "blue" | "steel" | "neutral";

export type Theme = "light" | "dark" | "system";
export type ToastKind = "info" | "success" | "error";

export type LineItem = {
  id: string;
  product: string;
  category: string;
  qty: number;
  price: number;
  discount: number;
  cap: number;
};

export type QuoteStage =
  | "Draft"
  | "Pending approval"
  | "Negotiation"
  | "Approved"
  | "Fulfillment"
  | "Subscribed"
  | "Invoiced"
  | "Paid";

export const routeNames: Record<Route, string> = {
  landing: "Homepage",
  login: "Login",
  signin: "Sign In",
  register: "Create Account",
  "forgot-password": "Reset Password",
  dashboard: "Dashboard",
  quotations: "Quotations",
  "quote-builder": "Quotation Detail",
  approvals: "Approvals",
  "approval-detail": "Approval Detail",
  fulfillment: "Fulfillment",
  "fulfillment-detail": "Fulfillment Detail",
  subscriptions: "Subscriptions",
  "billing-detail": "Billing",
  "customer-portal": "Customer",
  invoices: "Invoices",
  "invoice-detail": "Invoice Detail",
  "deal-health": "Deal Health",
  reports: "Reports",
  products: "Products",
  "product-detail": "Product Detail",
  "discount-setup": "Discount Setup"
};

export const flowRoutes: Route[] = [
  "signin",
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

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export const percent = (value: number) => `${value.toFixed(1)}%`;

export function pathForRoute(route: Route): string {
  if (route === "landing") return "/";
  if (route === "login") return "/signin";
  return `/${route}`;
}
