# SalesHub — Phase 3 Setup & Build Guide

> **Modules:** Customers, Invoices (Estimates + Invoices + Payments)
> **Prerequisites:** Phase 2 fully deployed (WhatsApp, Email, Calendar working. AiSensy, Pabbly, Calendly cancelled.)
> **Goal:** Convert prospects to customers, generate GST invoices, collect payments via Cashfree/Stripe. Stop manual invoicing.
> **Estimated timeline:** 3–4 weeks
> **Monthly savings after Phase 3:** ~₹1,000/month (accounting person)

---

## Pre-Phase 3 Checklist

### 1. Set Up Cashfree API

```
1. Go to https://www.cashfree.com → Dashboard (you already have an account)
2. Go to Developers → API Keys
3. Copy: App ID and Secret Key
4. For testing: use Sandbox credentials first
5. Set up webhook:
   - Developers → Webhooks → Add Endpoint
   - URL: https://app.xperiencewave.com/api/webhooks/cashfree
   - Events: PAYMENT_SUCCESS, PAYMENT_FAILED, PAYMENT_EXPIRED
```

### 2. Set Up Stripe API (for international payments)

```
1. Go to https://dashboard.stripe.com
2. Developers → API Keys → copy Publishable key + Secret key
3. Set up webhook:
   - Developers → Webhooks → Add Endpoint
   - URL: https://app.xperiencewave.com/api/webhooks/stripe
   - Events: checkout.session.completed, payment_intent.succeeded, 
             payment_intent.payment_failed
```

### 3. Update Environment Variables

Add to `.env.local` and Vercel:

```env
# Cashfree
CASHFREE_APP_ID=your_app_id
CASHFREE_SECRET_KEY=your_secret_key
CASHFREE_ENV=PRODUCTION  # or SANDBOX for testing

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx

# Business details (used in invoices)
BUSINESS_NAME=Expwave OPC Pvt. Ltd.
BUSINESS_GST=your_gst_number
BUSINESS_ADDRESS=328, Ground Floor, AECS Layout, B Block, Singasandra, Bangalore 560068
BUSINESS_STATE=Karnataka
BUSINESS_STATE_CODE=29
```

```bash
vercel env add CASHFREE_APP_ID
vercel env add CASHFREE_SECRET_KEY
vercel env add CASHFREE_ENV
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_PUBLISHABLE_KEY
vercel env add STRIPE_WEBHOOK_SECRET
```

---

## Step 1: Install Phase 3 Dependencies

```bash
cd saleshub

# PDF generation for invoices
npm install @react-pdf/renderer

# Stripe
npm install stripe

# Number to words (for invoice: "Rupees Seventeen Thousand Seven Hundred Only")
npm install num-words
```

---

## Step 2: New Folder Structure (Phase 3 Additions)

```
src/
├── app/
│   ├── (app)/
│   │   ├── customers/                     # ← BUILD THESE
│   │   │   ├── page.tsx                   # Customer list (similar to prospects but filtered)
│   │   │   └── [id]/
│   │   │       └── page.tsx               # Customer detail (extends contact detail page)
│   │   │
│   │   ├── invoices/                      # ← BUILD THESE
│   │   │   ├── page.tsx                   # Invoice list (all invoices + estimates)
│   │   │   ├── new/
│   │   │   │   └── page.tsx              # Invoice builder
│   │   │   └── [id]/
│   │   │       └── page.tsx              # Invoice detail / edit / view
│   │   │
│   │   └── settings/
│   │       └── profile/
│   │           └── page.tsx               # ← UPDATE: add GST number, business details
│   │
│   └── api/
│       ├── webhooks/
│       │   ├── cashfree/
│       │   │   └── route.ts               # ← BUILD: payment confirmation
│       │   └── stripe/
│       │       └── route.ts               # ← BUILD: payment confirmation
│       │
│       ├── invoices/
│       │   ├── route.ts                   # GET (list), POST (create)
│       │   └── [id]/
│       │       ├── route.ts               # GET, PATCH (update status)
│       │       ├── pdf/
│       │       │   └── route.ts           # Generate + return PDF
│       │       ├── send/
│       │       │   └── route.ts           # Send invoice via email + WhatsApp
│       │       └── payment-link/
│       │           └── route.ts           # Generate Cashfree/Stripe payment link
│       │
│       ├── customers/
│       │   ├── route.ts                   # GET (list customers)
│       │   └── convert/
│       │       └── route.ts               # POST: convert prospect to customer
│       │
│       └── cron/
│           ├── invoice-reminders/
│           │   └── route.ts               # Daily: check overdue invoices, send reminder
│           └── recurring-invoices/
│               └── route.ts               # Daily: generate recurring invoices
│
├── components/
│   ├── customers/                         # ← BUILD THESE
│   │   ├── customer-list.tsx              # Customer data table
│   │   ├── convert-to-customer-modal.tsx  # Confirmation + details modal
│   │   ├── program-tracker.tsx            # Mentorship program progress
│   │   └── renewal-alert.tsx              # Upcoming renewal banner
│   │
│   ├── invoices/                          # ← BUILD THESE
│   │   ├── invoice-builder.tsx            # Form: line items, dates, client
│   │   ├── invoice-preview.tsx            # Live preview (or PDF preview)
│   │   ├── invoice-pdf-template.tsx       # React-PDF template for generation
│   │   ├── invoice-list-table.tsx         # Invoices data table
│   │   ├── invoice-status-badge.tsx       # Draft/Sent/Paid/Overdue badge
│   │   ├── payment-link-generator.tsx     # Cashfree/Stripe link creation
│   │   ├── line-item-row.tsx              # Single line item in builder
│   │   └── gst-calculator.tsx             # Auto GST split logic
│   │
│   └── prospects/
│       └── prospect-detail.tsx            # ← UPDATE: Invoices tab now shows real data
│
├── lib/
│   ├── payments/                          # ← BUILD THESE
│   │   ├── cashfree.ts                    # Cashfree API: create payment link, verify
│   │   ├── stripe.ts                      # Stripe API: create checkout session
│   │   └── webhook-handler.ts             # Shared: process payment confirmations
│   │
│   └── pdf/
│       └── invoice-template.tsx           # React-PDF invoice template
│
├── hooks/
│   ├── use-invoices.ts                    # Invoice CRUD
│   ├── use-customers.ts                   # Customer operations
│   └── use-payments.ts                    # Payment link generation
│
└── types/
    ├── invoices.ts                        # Invoice, line item, payment types
    └── customers.ts                       # Customer-specific types
```

---

## Step 3: Database Additions

Run in Supabase SQL Editor:

```sql
-- Customer programs (mentorship tracking)
CREATE TABLE customer_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL, -- e.g., 'Current (Senior Mentorship)', 'Ripple', 'Tide'
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  start_date DATE,
  end_date DATE, -- NULL if ongoing
  sessions_total INT,
  sessions_completed INT DEFAULT 0,
  next_session_date DATE,
  mentor_id UUID REFERENCES team_members(id),
  amount DECIMAL(10,2), -- program price
  billing_cycle TEXT CHECK (billing_cycle IN ('one_time', 'monthly', 'quarterly')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_customer_programs_contact ON customer_programs(contact_id);

-- Invoice sequence counter
CREATE TABLE invoice_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix TEXT NOT NULL DEFAULT 'XW',
  financial_year TEXT NOT NULL, -- '2025-26', '2026-27'
  last_number INT NOT NULL DEFAULT 0,
  UNIQUE(prefix, financial_year)
);

-- Insert first sequence
INSERT INTO invoice_sequences (prefix, financial_year, last_number) 
VALUES ('XW', '2025-26', 0);

-- Add state field to contacts (for GST calculation)
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS gst_number TEXT;
```

---

## Phase 3 Build Order

### Week 1: Invoicing Foundation

```
1.  Invoice number generator
    → Utility function: getNextInvoiceNumber()
    → Pattern: XW-2026-001, XW-2026-002, etc.
    → Uses invoice_sequences table with atomic increment
    → Financial year: April–March (Indian standard)
    → Estimate numbers: XW-EST-2026-001

2.  GST calculation logic (src/components/invoices/gst-calculator.tsx)
    → Input: line items array + customer state
    → Logic:
      If customer state = Karnataka (same as business):
        CGST = 9%, SGST = 9% (total 18%)
      Else:
        IGST = 18%
    → Output: subtotal, cgst, sgst, igst, total
    → SAC code support: default 999293 (education services)
    → Reference: ARCHITECTURE.md Section 6.6
    → [Pending: your GST handling decision — auto-detect vs manual]

3.  Invoice builder page (src/app/(app)/invoices/new/page.tsx)
    → [Pending: your decision on Form+Preview vs WYSIWYG vs Form only]
    → Fields:
      Client selector (search contacts by name/email/phone)
      Invoice number (auto-generated, editable)
      Invoice date + due date
      Line items:
        - Description, SAC code, quantity, rate, amount (auto-calc)
        - "+ Add line item" button
        - Drag to reorder rows
      Notes / terms (textarea)
      Payment method: Cashfree / Stripe / Manual
    → GST auto-calculation updates as you type
    → Save as: Draft, or Send immediately
    → Reference: ARCHITECTURE.md Section 6.6

4.  Invoice PDF template (src/lib/pdf/invoice-template.tsx)
    → React-PDF component
    → Professional layout: XW logo, business details, GST number
    → Sections: From (Expwave), To (client), items table, GST breakup, total
    → Amount in words: "Rupees Seventeen Thousand Seven Hundred Only"
    → Footer: payment terms, bank details (optional), digital signature placeholder
    → [Pending: your decision on template design — fixed vs customizable]

5.  Invoice PDF API (src/app/api/invoices/[id]/pdf/route.ts)
    → Generates PDF server-side using React-PDF
    → Saves to Supabase Storage
    → Returns PDF URL + stores in invoices.pdf_url
```

### Week 2: Payments + Invoice Workflow

```
6.  Cashfree integration (src/lib/payments/cashfree.ts)
    → createPaymentLink(invoiceId, amount, customerEmail, customerPhone)
    → Returns: payment link URL
    → Store link in invoices.payment_link
    → Reference: ARCHITECTURE.md Section 7.5

7.  Stripe integration (src/lib/payments/stripe.ts)
    → createCheckoutSession(invoiceId, amount, customerEmail)
    → Returns: Stripe checkout URL
    → Reference: ARCHITECTURE.md Section 7.5

8.  Payment webhooks
    → Cashfree webhook (src/app/api/webhooks/cashfree/route.ts):
      On PAYMENT_SUCCESS: mark invoice as paid, log activity, 
      send confirmation WhatsApp + email
    → Stripe webhook (src/app/api/webhooks/stripe/route.ts):
      Same flow for checkout.session.completed
    → Both: verify webhook signature for security
    → Reference: ARCHITECTURE.md Section 7.5

9.  Invoice send flow (src/app/api/invoices/[id]/send/route.ts)
    → Generate PDF if not exists
    → Generate payment link (Cashfree or Stripe based on invoice setting)
    → Send email: attach PDF + payment link button
    → Send WhatsApp: template with payment link
    → Update invoice status: draft → sent
    → Log activity on contact
    → Show toast: "Invoice sent to Mohit via email + WhatsApp"

10. Invoice list page (src/app/(app)/invoices/page.tsx)
    → Data table: invoice #, client name, amount, status, date, due date
    → Status filters: All, Draft, Sent, Paid, Overdue
    → Tab or toggle: Invoices | Estimates
    → Quick actions per row: View, Send, Mark as Paid (manual), Download PDF
    → Summary bar at top:
      Total outstanding: ₹X | Overdue: ₹X | Paid this month: ₹X
    → Reference: DESIGN_SYSTEM.md Section 4.5 (data table pattern)

11. Invoice detail page (src/app/(app)/invoices/[id]/page.tsx)
    → Shows the invoice preview (same as builder preview)
    → Actions: Edit (if draft), Send, Download PDF, Generate Payment Link,
      Mark as Paid (manual), Convert to Invoice (if estimate)
    → Payment status timeline: sent → payment link clicked → paid
    → Reference: ARCHITECTURE.md Section 6.6
```

### Week 3: Customers Module + Recurring + Polish

```
12. Convert to Customer flow
    → When a prospect's stage is moved to "Converted" in Kanban/list:
      Modal appears: "Convert to Customer"
      Fields:
        Program: dropdown (Current, Ripple, Tide, Custom)
        Start date
        Sessions (if applicable)
        Billing: one-time, monthly, quarterly
        Amount
        Create invoice now? Toggle
    → On confirm:
      a. Update contact type: prospect → customer
      b. Set converted_at timestamp
      c. Create customer_programs record
      d. Optionally create draft invoice
      e. Log activity
    → Reference: ARCHITECTURE.md Section 6.5

13. Customer list page (src/app/(app)/customers/page.tsx)
    → Separate route from Prospects
    → Data table: Name, Program, Status, Start Date, Sessions Progress, 
      Next Payment, Total Paid
    → Filters: by program, by status (active, completed)
    → Different feel from Prospects — no pipeline/Kanban, 
      more about relationship management
    → Reference: ARCHITECTURE.md Section 6.5

14. Customer detail page (src/app/(app)/customers/[id]/page.tsx)
    → Same Contact Detail layout (identity zone + tabs)
    → Additional tabs (or enriched Overview tab):
      - Programs: cards showing each enrolled program, progress bar,
        next session date, mentor
      - Payments: all invoices for this customer, total paid,
        next payment due
      - Renewals: upcoming renewal dates with countdown
    → Quick actions: same as prospect + "Create Invoice" replaces less relevant ones
    → Reference: ARCHITECTURE.md Section 6.5

15. Recurring invoices (src/app/api/cron/recurring-invoices/route.ts)
    → Cron: runs daily at midnight
    → Check invoices where is_recurring = true
    → For each: if today = recurrence_day of month
      Generate new invoice (copy line items, update dates)
      Auto-send if auto_send is enabled
    → Create task for manual review if auto_send is off
    → Reference: ARCHITECTURE.md Section 6.6

16. Overdue invoice reminders (src/app/api/cron/invoice-reminders/route.ts)
    → Cron: runs daily at 9 AM
    → Find invoices where status = 'sent' AND due_date < today
    → Update status to 'overdue'
    → Send reminder email + WhatsApp to the customer
    → Create task for salesperson: "Follow up on overdue invoice for {name}"
    → Only send reminder once every 3 days (avoid spamming)

17. Invoices tab on Contact Detail
    → Both Prospect and Customer detail pages
    → Shows: all invoices/estimates for this contact
    → Mini table: invoice #, amount, status, date
    → "Create Invoice" button
    → Click invoice → opens invoice detail page

18. Dashboard updates
    → Revenue stat card: now pulls from real invoice data
    → Today's Focus: includes "Send invoice to {name}" for new conversions
                     and "Overdue: {name} owes ₹X" for overdue invoices
    → Pipeline Health: add conversion → invoice → paid funnel

19. Estimate → Invoice conversion
    → On estimate detail page: "Convert to Invoice" button
    → Creates new invoice with same line items
    → Assigns next invoice number
    → Original estimate status → 'converted'
    → Link between estimate and invoice for audit trail

20. Settings: Business profile
    → Settings → Profile page: add fields for
      Business name, GST number, PAN number, address, state
      Bank details (for invoice footer — optional)
      Logo upload (for invoice PDF header)
    → These feed into the invoice PDF template

21. Update sidebar: enable Phase 3 modules
    → In constants.ts: change CURRENT_PHASE to 3
    → Customers and Invoices nav items become active

22. Testing
    → Create a test invoice, generate PDF, verify GST calculations
    → Test Cashfree payment link end-to-end (use test mode)
    → Test Stripe checkout end-to-end (use test mode)
    → Test webhook: make a payment, verify invoice auto-marks as paid
    → Test recurring: set recurrence_day to today, verify new invoice generates
    → Convert a real prospect to customer, verify full flow
    → Run npm run build — fix errors
    → Let your accounting person verify 2-3 invoices for GST correctness
```

---

## Week-by-Week Summary

| Week | Focus | Deliverable |
|------|-------|-------------|
| **1** | Invoice builder + PDF + GST logic | Create and download professional GST invoices |
| **2** | Payments + send flow + invoice management | Collect payments via Cashfree/Stripe, auto-mark paid |
| **3** | Customers module + recurring + cron jobs + polish | Full prospect→customer→invoice→payment lifecycle |

---

## How to Use Claude for Phase 3 Building

### Example Prompts

**Invoice PDF template:**
> "I'm building SalesHub Phase 3. Build the invoice PDF template using @react-pdf/renderer at src/lib/pdf/invoice-template.tsx. It should be a professional GST-compliant Indian invoice. Reference: docs/ARCHITECTURE.md Section 6.6 for the invoice schema. Business: Expwave OPC Pvt Ltd, Karnataka. GST logic: CGST+SGST if same state, IGST if different. Include: logo placeholder, from/to details, items table with SAC codes, GST breakup, total in words, payment terms. Follow docs/DESIGN_SYSTEM.md Horizon palette for any colors."

**Cashfree integration:**
> "Build the Cashfree payment integration at src/lib/payments/cashfree.ts. Reference: docs/PHASE3_SETUP.md Step 6. Functions: createPaymentLink(invoiceId, amount, customerEmail, customerPhone) that calls Cashfree's Create Order API and returns a payment link. Also build the webhook handler at src/app/api/webhooks/cashfree/route.ts that verifies the signature, marks the invoice as paid, logs an activity on the contact, and sends a WhatsApp confirmation."

**Convert to Customer modal:**
> "Build the Convert to Customer modal component at src/components/customers/convert-to-customer-modal.tsx. Reference: docs/PHASE3_SETUP.md Step 12 and docs/ARCHITECTURE.md Section 6.5. Triggered when a prospect is moved to 'Converted' stage. Form fields: program selector, start date, sessions, billing cycle, amount, toggle to create invoice. On confirm: update contact type, create customer_program record, optionally create draft invoice. Use shadcn/ui Dialog + Form components. Follow docs/DESIGN_SYSTEM.md."

---

## Important Reminders

- **Test with Sandbox/Test mode first** — both Cashfree and Stripe have test environments
- **Verify GST calculations with your CA** before sending real invoices
- **Invoice numbers must be sequential** — gaps in numbering can be flagged during audit
- **Keep the accounting person until Phase 3 is verified** — have them audit 5+ invoices
- **Payment webhooks MUST be idempotent** — the same event can arrive multiple times
- **Recurring invoices need manual review option** — don't auto-send without confirmation initially
- **Back up your database before Phase 3 migration** — you're touching financial data now

---

*Reference documents:*
- *ARCHITECTURE.md — Database schema (Section 5), Module specs (Section 6.5, 6.6), API integrations (Section 7.5)*
- *DESIGN_SYSTEM.md — Visual language, component specs*
- *PAGE_LAYOUTS.md — Contact Detail layout (extends to Customer Detail)*
- *LAYOUTS_PHASE3.md — [To be created when Phase 3-4 layouts are specced]*

*Last updated: February 26, 2026*
