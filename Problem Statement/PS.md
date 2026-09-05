# DealFlow360
### An Intelligent, Self-Governing Sales Operations Platform

This hackathon project is a Sales Operations platform called **"DealFlow360"**, designed to handle:

- **Multi-tier discount governance** and automated approval routing
- **Live upsell and cross-sell recommendations** while building a quotation
- **Multi-warehouse fulfillment splitting** and backorder handling
- **Hybrid billing** (one-time products mixed with recurring subscription lines)
- **Deal health monitoring** and anomaly alerts
- **Customer-facing portal negotiation** on live quotations
- **Sales backend configuration** and reporting dashboards

---

## 1) Project Overview

Most simple sales tools handle the basics well: create a quote, confirm an order, invoice it. Real B2B sales teams operate in messier conditions such as multi-level discount approvals, partial stock spread across warehouses, bundled subscriptions mixed with one-time hardware, customers who want to negotiate inside a portal instead of over email, and managers who only find out a deal is stuck after it has already lost momentum.

The goal of this project is to build a sales platform that goes beyond a quote-to-invoice form and becomes a self-governing deal engine—one that enforces pricing discipline, reacts to inventory reality in real time, keeps subscriptions and one-time sales reconciled on a single order, and gives both sales reps and customers a living, negotiable document instead of a static PDF.

Teams are free to use any programming language, framework, or database technology to build this solution. The focus is on the business logic, the data model, and the end-to-end workflow, not on any specific platform or vendor.

---

## 2) Goals & Scope

### Main Goal
Build a complete sales flow including backend configuration and a frontend quotation-to-cash experience.

### Key Outcomes
- **Automated Approval Routing:** Sales rep can log in, build a quotation, and have it auto-route for the correct approval based on discount and customer tier.
- **Real-Time Margin & Upsell:** Rep receives live upsell and cross-sell suggestions with real-time margin impact while building the quote.
- **Smart Warehouse Splitting:** Order can be automatically split across warehouses based on stock availability, with manual override.
- **Hybrid Billing & Proration:** A single order can mix one-time products and recurring subscription lines with correct proration and billing schedules.
- **Deal Health Monitoring:** Dashboard shows deal health, stalled quotes, and discount anomalies in real time.
- **Interactive Customer Portal:** Customer can view and negotiate the quotation directly from a customer-facing portal without email back-and-forth.

---

## 3) User Roles

### Sales Rep
- Builds quotations, applies discounts, adds upsell items
- Tracks approval status and fulfillment progress
- Responds to customer negotiation requests

### Sales Manager / Approver
- Reviews and approves or rejects quotations that exceed discount thresholds
- Configures discount tiers and approval chains
- Monitors deal health dashboard for at-risk deals

### Finance / Operations User
- Handles second-level approvals for high-risk discounts
- Manages warehouse fulfillment splits and backorder decisions
- Reconciles recurring billing and credit notes

### Customer (Portal User)
- Views quotation online
- Requests changes, asks line-level questions, or counters a discount
- Confirms final terms with one click

### Admin
- Manages backend setup: products, price lists, discount tiers, warehouses, subscription plans
- Views platform-wide analytics and reporting

---

## 4) Modules / Features Breakdown

### A) Sales Backend (Configuration Area)

#### A1) Authentication (Login / Signup)
- Internal users can sign up and log in with standard credentials.
- Customers access their quotations through a portal login (magic link, or email and password).
- After login, internal users can access backend configuration and open a sales workspace.

#### A2) Product & Price List Management
- **General Info:** Name, Category, Price, Unit, Tax, Product Description
- **Variants:** Attribute (example: Size or Pack), Values, Extra prices
- **Price Lists:** Customer tier-based pricing, currency-specific rules

#### A3) Discount Tier & Approval Chain Setup
- Define discount ceilings per customer tier (example: Bronze up to 5%, Silver up to 10%, Gold up to 15%).
- Define category-specific discount ceilings (some product categories allow higher discretion than others).
- Configure approval chain: which discount range needs Sales Manager only, and which range needs Sales Manager followed by Finance.

> **Notes:**
> - When a quote mixes categories with different ceilings, the system must compute a blended risk score and route to the highest required level.
> - All approvals, rejections, and edits must be logged with user, timestamp, and reason.

#### A4) Warehouse & Fulfillment Setup
- Create and manage warehouses (example: `"Main Warehouse"`, `"East Depot"`).
- Configure stock levels and replenishment rules per warehouse.
- Define shipping cost weighting used by the auto-split logic to minimize number of shipments.

#### A5) Subscription / Recurring Plan Setup
- Define recurring plans (monthly, quarterly, yearly) that can be attached to specific products or services.
- Configure proration rules for mid-cycle quantity or plan changes.
- Configure cancellation and partial refund rules.

#### A6) Upsell / Cross-Sell Rule Setup (Optional)
- Define product pairings based on historical co-purchase data.
- Mark products as currently promoted so they rank higher in suggestions.
- Set minimum margin thresholds so only healthy margin suggestions surface.

#### A7) Reporting & Dashboard Configuration
- Dashboard plus reporting menu for sales performance.
- Export options: PDF / XLS.

**Reporting Filters (Purpose):**
- **Period:** View quotations and orders within a date range (today, week, custom range).
- **Sales Team / Rep:** Filter reports by responsible rep or team to analyze individual or team performance.
- **Approval Status:** Filter by pending, approved, or rejected quotations.
- **Product / Category:** Filter reporting to track best-selling or most discounted items.

---

### B) Sales Frontend (Rep Workspace Experience)

#### B1) Sales Workspace, Top Menu
- **Top Navigation Contains:**
  - **Quotations:** Redirects to the list of active and draft quotations.
  - **Pipeline:** Opens a Kanban-style deal pipeline view.
- **Actions:**
  - **Reload Data:** Refreshes pricing, stock, and approval data from the backend.
  - **Go to Back-end:** Opens the configuration and settings screen.
  - **Close Workspace:** Ends the current working session view.

#### B2) Quotation List / Pipeline View
- Quotations appear as selectable cards showing customer, amount, and stage.
- Example entries: `"Acme Corp, Draft"`, `"Beta Industries, Pending Approval"`.
- Selecting a quotation opens the Quotation Builder for that deal.

#### B3) Quotation Builder Screen (Products + Cart)
- Pick products across categories (Hardware, Services, Subscriptions).
- Adjust quantities (`+` / `-`).
- Apply line-level or order-level discounts.
- View order lines with price totals and a live margin indicator.
- Confirm and move to approval, or straight to fulfillment if no approval is required.

#### B4) Discount Approval Screen
- **Approval Screen Includes:**
  - Blended risk score for the quotation.
  - Approval steps list: Sales Manager, and Finance (only shown when required).
- **After Each Reviewer Acts:**
  - Approve, reject, or return for revision.
  - Confirmation screen with a full audit trail entry.

#### B5) Upsell and Cross-Sell Panel (Special Flow)
When building a quotation, this panel is shown alongside the cart:
- Ranked suggestion list based on co-purchase history and active promotions.
- **Displays:**
  - Suggested product
  - Margin delta if added
  - Promotion tag if applicable
- **Buttons:**
  - `Add to Quote`
  - `Dismiss`
- *After adding a suggestion, the margin indicator on the quotation updates immediately.*

#### B6) Fulfillment and Warehouse Split Screen
- Shows recommended warehouse split for the order based on live stock.
- **Displays:**
  - Warehouse name
  - Quantity fulfilled from that warehouse
  - Estimated shipment count and cost
- **Buttons:**
  - `Accept Suggested Split`
  - `Manual Override`
- *If stock arrives mid-fulfillment, a "Consolidate Remaining Backorder" prompt appears automatically.*

#### B7) Subscription and Billing Screen
- Shows one-time lines and recurring lines separately within the same order.
- Displays upcoming billing schedule for recurring lines.
- Handles mid-cycle proration when quantity changes.
- Cancel or modify subscription controls, with an automatic partial refund or credit note trigger when applicable.

#### B8) Customer Portal Negotiation Screen
*Customer-facing screen, separate from the internal workspace:*
- Shows quotation details and current status (`Sent`, `Under Negotiation`, `Confirmed`).
- Line-level comment and change request tool.
- Counter discount proposal field.
- **Buttons:**
  - `Submit Request`
  - `Confirm Quotation`
- **After Confirmation:**
  - If final terms exceed approval thresholds, the quotation automatically re-enters the approval flow from B4.
  - Otherwise, the order moves directly to fulfillment.

#### B9) Deal Health and Anomaly Dashboard
**Dashboard Shows:**
- Stalled deals (quotations inactive for more than a configured number of days).
- Discount anomaly alerts (a discount well above a rep's historical average).
- Delivery promise slippage indicators.
- Clicking an alert opens the related quotation directly.
- An automated nudge or escalation action can be triggered from an alert.

---

## 5) Complete Flow (End-to-End)

1. **Sign-up / Login:** Sales rep signs up (first time) or logs in to access the system.
2. **Backend Setup:** Admin configures the backend (products, price lists, discount tiers, approval chains, warehouses, subscription plans).
3. **Quotation Creation:** Rep opens the workspace and creates a new quotation for a customer.
4. **Cart & Recommendations:** Rep adds products, applies discounts, and reviews upsell suggestions in the panel.
5. **Approval Routing:** If the discount or blended risk score exceeds a threshold, the quotation is automatically routed for approval (Sales Manager, then Finance if required).
6. **Warehouse Split:** Once approved, or immediately if no approval was needed, the system suggests a warehouse fulfillment split.
7. **Hybrid Invoicing:** Order may include recurring subscription lines, which generate a billing schedule alongside any one-time invoice.
8. **Customer Negotiation:** Customer receives the quotation link and can negotiate directly through the portal.
9. **Re-approval Check:** If terms change beyond thresholds during negotiation, the quote re-enters the approval flow automatically.
10. **Fulfillment & Billing:** Once confirmed, the order proceeds to fulfillment and billing.
11. **Deal Health Tracking:** Manager reviews the Deal Health dashboard throughout the cycle to catch stalled or risky deals early.
12. **Analytics & Reports:** Reports are reviewed using filters (Period / Sales Team / Approval Status / Product).

---

## 6) Why This Hackathon Problem Is Important

- **Real-World Sales Workflow:** Shows how a complete B2B sales process works end-to-end (`Quotation → Approval → Fulfillment → Billing → Customer Negotiation → Reporting`).
- **Business Logic Focus:** Teaches handling practical operational rules like discount governance, multi-warehouse fulfillment, subscription proration, and customer negotiation—not just UI screens.
- **Industry-Ready System Thinking:** Builds a production-like solution with role-based access, approval chains, inventory coordination, recurring billing, audit trails, and deal analytics.
- **Technology Agnostic:** Teams can apply this problem statement using any language, framework, or database of their choice, so the focus stays on design, data modeling, and workflow logic.

---

## 7) Technical Guidelines

- **Tech Stack Flexibility:** Teams may use any tech stack (any backend language, any frontend framework, any relational or document database).
- **Enforce in Business Logic:** Core business rules (approval routing, discount governance, warehouse splitting, billing proration) must be implemented in application logic, not hardcoded or faked for the demo.
- **Separate Customer Portal:** The customer-facing negotiation screen must be a real, separate, restricted view, not just another internal screen with a different label.
- **Bonus Scope:** Multi-currency or multi-company support is a bonus, not a requirement.

---

## 8) Deliverables

- [ ] **Working Application:** Backend plus frontend with sample seed data.
- [ ] **5-Minute Live Demo:** Covering at least two full flows end-to-end, from quotation to fulfillment or billing.
- [ ] **One-Page Architecture Diagram:** Showing the data model and how the major modules connect.
- [ ] **Roadmap Note:** A short note on what the team would build next with more time.

---

## 9) Quick Test Flow (Login to Payment)

Use this short walkthrough to check that the core logic actually works, not just the screens. Each step should produce a visible, correct result before moving to the next one.

1. **Backend Initialization:** Sign up or log in, and set up basic backend data: a discount tier, a warehouse, and a subscription plan.
2. **Exceed Discount Ceiling:** Create a quotation and add a product line with a discount that is higher than what is normally allowed.
3. **Verify Auto-Routing:** Confirm the quotation automatically asks for manager approval, without the rep having to request it manually.
4. **Test Upsell & Margins:** While building the quote, accept one upsell suggestion and confirm the order total and margin update right away.
5. **Fulfillment Split:** Get the quotation approved, then confirm that stock is being pulled from the correct warehouse, splitting across two warehouses if needed.
6. **Hybrid Billing Split:** Check that a one-time product and a recurring subscription on the same order are billed correctly and separately.
7. **Portal Counter-Offer:** Open the customer portal view and request a bigger discount as the customer, then confirm the quote goes back for approval automatically.
8. **Payment & Invoicing:** Confirm the order, record a payment, and check that the invoice status updates correctly.

> [!NOTE]
> If all eight steps work smoothly and each result matches what is expected, the core flow is solid.

---

## 10) Understanding the Blended Discount Risk Score

This score decides whether a quotation needs manager approval, and if needed, whether it also needs finance approval.

### The Core Concept
The simplest way to think about it: **different products are allowed different discount limits**, and the system checks every line against its own limit, not just one overall limit for the whole order.

### Example
A **Gold customer** is normally allowed up to **15% discount**. But within that same order:
- **Hardware items** are allowed up to **15%**, since they have healthy margins.
- **Service items** are allowed only up to **10%**, since they have thin margins.

Now say a rep builds this quote:
- **Laptop (Hardware):** 12% discount given, 15% allowed &rarr; *this line is fine.*
- **Setup Service (Service):** 18% discount given, only 10% allowed &rarr; *this line is 8 points over its limit.*

Even though the customer is Gold and 15% sounds fine on paper, the Service line broke its own stricter limit. So the whole quotation gets flagged for approval, because of that one line.

### Why "Blended"?
Sometimes no single line is badly over its limit, but many lines are each a little over. One line 2 points over, another 3 points over, another 2 points over. None of them look alarming alone, but added together across the order, the rep has quietly given away a lot of margin.

The blended score looks at the total pattern across the order, not just the single worst line, so small violations spread across many lines cannot slip through unnoticed.

### Why This Matters
- It decides who needs to review the deal before it is approved, so managers are not stuck reviewing every single quotation by hand.
- It stops a rep from keeping every line technically within limits while still discounting the order more than the company intends overall.

---

## References & Wireframes

- **Interactive Wireframe Mockup:** [DealFlow360 Excalidraw](https://app.excalidraw.com/l/65VNwvy7c4X/7Fb5SR3WKu2)