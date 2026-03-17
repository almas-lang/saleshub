# SalesHub — Phase 4 Setup & Build Guide

> **Modules:** Finance (Revenue, Expenses, P&L, Tax), Analytics, Full Dashboard, Team Management, Complete Settings
> **Prerequisites:** Phase 3 fully deployed (Customers, Invoices, Payments all working)
> **Goal:** Complete financial picture, data-driven decision making, full team management. SalesHub is now the only tool you need.
> **Estimated timeline:** 4–5 weeks
> **After Phase 4:** SalesHub is feature-complete. All 10 modules live.

---

## Pre-Phase 4 Checklist

### 1. Data Audit

Before building Finance and Analytics, you need clean data to report on. Verify:

```
□ All invoices from Phase 3 have correct amounts and GST
□ Payment webhooks are reliably marking invoices as paid
□ Activities are being logged consistently across all modules
□ Contact sources and UTM fields are populated (for attribution analytics)
□ Team members table has Murad + Almas + any new salesperson
```

### 2. Optional: Meta Ads API Access

If you want ad spend to auto-import (instead of manual entry), set up Meta Marketing API:

```
1. Meta Business Manager → Business Settings → System Users
2. Use the same "SalesHub" system user from Phase 2
3. Add permission: ads_read
4. Generate a new token with ads_read + whatsapp_business_messaging
5. Note your Ad Account ID: Business Manager → Ad Accounts → ID
```

This is optional — manual ad spend entry works fine and is simpler.

### 3. Update Environment Variables (if using Meta Ads API)

```env
# Meta Ads (optional)
META_ADS_ACCOUNT_ID=act_xxxxxxxxxx
META_ADS_ACCESS_TOKEN=your_token_with_ads_read
```

---

## Step 1: Install Phase 4 Dependencies

```bash
cd saleshub

# Charting library (for analytics dashboards)
npm install recharts

# Date range picker (for report filters)
npm install react-day-picker

# CSV/Excel export (for tax reports)
npm install xlsx

# File upload (for expense receipts)
# Supabase Storage is already set up — no new dependency needed
```

---

## Step 2: New Folder Structure (Phase 4 Additions)

```
src/
├── app/
│   ├── (app)/
│   │   ├── finance/                       # ← BUILD THESE
│   │   │   ├── page.tsx                   # Finance overview (revenue + expenses summary)
│   │   │   ├── expenses/
│   │   │   │   ├── page.tsx               # Expense list + add expense
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx           # Expense detail / edit
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx               # Report selector (P&L, GST, Revenue)
│   │   │   │   ├── pnl/
│   │   │   │   │   └── page.tsx           # Profit & Loss report
│   │   │   │   ├── gst/
│   │   │   │   │   └── page.tsx           # GST summary report
│   │   │   │   └── revenue/
│   │   │   │       └── page.tsx           # Revenue breakdown report
│   │   │   └── ad-spend/
│   │   │       └── page.tsx               # Ad spend tracking + ROI
│   │   │
│   │   ├── analytics/                     # ← BUILD THESE
│   │   │   ├── page.tsx                   # Analytics overview dashboard
│   │   │   ├── leads/
│   │   │   │   └── page.tsx               # Lead analytics (sources, campaigns, trends)
│   │   │   ├── pipeline/
│   │   │   │   └── page.tsx               # Pipeline analytics (conversion, drop-off)
│   │   │   ├── communication/
│   │   │   │   └── page.tsx               # Email + WhatsApp performance
│   │   │   └── team/
│   │   │       └── page.tsx               # Per-salesperson performance
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx                   # ← REBUILD: Full comprehensive dashboard
│   │   │
│   │   └── settings/                      # ← COMPLETE THESE
│   │       ├── team/
│   │       │   └── page.tsx               # Team management (add/remove/roles)
│   │       ├── integrations/
│   │       │   └── page.tsx               # All integration statuses + config
│   │       └── notifications/
│   │           └── page.tsx               # Notification preferences
│   │
│   └── api/
│       ├── finance/
│       │   ├── transactions/
│       │   │   ├── route.ts               # GET (list), POST (create expense)
│       │   │   └── [id]/
│       │   │       └── route.ts           # GET, PATCH, DELETE
│       │   ├── reports/
│       │   │   ├── pnl/
│       │   │   │   └── route.ts           # Generate P&L data
│       │   │   ├── gst/
│       │   │   │   └── route.ts           # Generate GST summary
│       │   │   └── revenue/
│       │   │       └── route.ts           # Revenue breakdown data
│       │   └── ad-spend/
│       │       ├── route.ts               # GET/POST ad spend entries
│       │       └── import/
│       │           └── route.ts           # Import from Meta Ads API
│       │
│       ├── analytics/
│       │   ├── leads/
│       │   │   └── route.ts              # Lead analytics queries
│       │   ├── pipeline/
│       │   │   └── route.ts              # Pipeline/funnel analytics
│       │   ├── communication/
│       │   │   └── route.ts              # Email + WA analytics
│       │   └── team/
│       │       └── route.ts              # Per-user performance
│       │
│       ├── team/
│       │   ├── route.ts                  # GET (list), POST (invite)
│       │   └── [id]/
│       │       └── route.ts              # PATCH (role), DELETE (remove)
│       │
│       ├── export/
│       │   └── route.ts                  # Export reports as CSV/XLSX
│       │
│       └── cron/
│           └── weekly-analytics/
│               └── route.ts              # Weekly summary email to team
│
├── components/
│   ├── finance/                           # ← BUILD THESE
│   │   ├── revenue-overview.tsx           # Revenue summary cards + chart
│   │   ├── expense-form.tsx               # Add/edit expense
│   │   ├── expense-list.tsx               # Expense table with filters
│   │   ├── receipt-upload.tsx             # File upload to Supabase Storage
│   │   ├── pnl-report.tsx                # P&L table component
│   │   ├── gst-report.tsx                # GST summary component
│   │   ├── ad-spend-tracker.tsx           # Ad spend entry + ROI calculation
│   │   ├── category-breakdown.tsx         # Pie/bar chart by expense category
│   │   └── export-button.tsx             # Download as CSV/XLSX
│   │
│   ├── analytics/                         # ← BUILD THESE
│   │   ├── lead-source-chart.tsx          # Bar chart: leads by source
│   │   ├── lead-trend-chart.tsx           # Line chart: leads over time
│   │   ├── utm-breakdown.tsx              # Table: UTM campaign performance
│   │   ├── funnel-visualization.tsx       # Funnel/waterfall: stage conversion
│   │   ├── stage-time-chart.tsx           # Avg time per pipeline stage
│   │   ├── email-performance.tsx          # Open/click rates by campaign
│   │   ├── wa-performance.tsx             # Delivery/read rates by campaign
│   │   ├── template-leaderboard.tsx       # Best performing templates
│   │   ├── revenue-chart.tsx              # Revenue over time (line/bar)
│   │   ├── team-leaderboard.tsx           # Per-salesperson stats table
│   │   ├── date-range-filter.tsx          # Reusable: date range selector
│   │   └── metric-card.tsx               # Reusable: single metric with trend
│   │
│   ├── dashboard/                         # ← REBUILD THESE
│   │   ├── stats-cards.tsx                # Updated: real data from all modules
│   │   ├── todays-focus.tsx               # Updated: includes financial items
│   │   ├── pipeline-health.tsx            # Updated: real conversion data
│   │   ├── recent-activity.tsx            # Already built — may need updates
│   │   ├── revenue-mini-chart.tsx         # New: sparkline revenue trend
│   │   └── team-summary.tsx              # New: per-person quick stats
│   │
│   ├── settings/                          # ← BUILD THESE
│   │   ├── team-member-card.tsx           # Team member display + role badge
│   │   ├── invite-member-modal.tsx        # Invite new team member form
│   │   ├── role-selector.tsx              # Admin / Sales role picker
│   │   ├── integration-card.tsx           # Integration status card
│   │   └── notification-preferences.tsx   # Toggle notification types
│   │
│   └── shared/
│       ├── date-range-picker.tsx          # Reusable date range component
│       └── export-dropdown.tsx            # Export as CSV / XLSX / PDF dropdown
│
├── lib/
│   ├── finance/
│   │   ├── calculations.ts               # P&L calc, GST summary, ROAS
│   │   └── export.ts                     # Generate CSV/XLSX from report data
│   │
│   ├── analytics/
│   │   └── queries.ts                    # Complex analytics SQL queries
│   │
│   └── meta-ads/
│       └── client.ts                     # Meta Marketing API wrapper (optional)
│
├── hooks/
│   ├── use-transactions.ts               # Expense/income CRUD
│   ├── use-analytics.ts                  # Analytics data fetching
│   ├── use-reports.ts                    # Report generation
│   ├── use-team.ts                       # Team member management
│   └── use-date-range.ts                # Shared date range state
│
└── types/
    ├── finance.ts                        # Transaction, report types
    ├── analytics.ts                      # Analytics response types
    └── team.ts                           # Team member, role types
```

---

## Step 3: Database Additions

Run in Supabase SQL Editor:

```sql
-- Transactions table (the core of Finance module)
-- This may already exist from Phase 1 schema creation — if so, skip
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  invoice_id UUID REFERENCES invoices(id),
  contact_id UUID REFERENCES contacts(id),
  date DATE NOT NULL,
  gst_applicable BOOLEAN DEFAULT false,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  receipt_url TEXT,
  created_by UUID REFERENCES team_members(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_category ON transactions(category);

-- Expense categories (predefined, extensible)
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT, -- Lucide icon name
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO expense_categories (name, icon, is_default) VALUES
  ('Meta Ads', 'Megaphone', true),
  ('Google Ads', 'Search', true),
  ('Software & Tools', 'Monitor', true),
  ('Salary & Contractors', 'Users', true),
  ('Office & Rent', 'Building', true),
  ('Travel', 'Plane', true),
  ('Marketing (Other)', 'TrendingUp', true),
  ('Professional Services', 'Briefcase', true),
  ('Miscellaneous', 'MoreHorizontal', true);

-- Ad spend tracking (separate for detailed ROI analysis)
CREATE TABLE ad_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'linkedin', 'other')),
  campaign_name TEXT,
  campaign_id TEXT, -- Meta/Google campaign ID for API import
  date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  impressions INT,
  clicks INT,
  leads_generated INT, -- manually tagged or auto-matched via UTM
  cost_per_lead DECIMAL(10,2), -- calculated: amount / leads_generated
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_ad_spend_date ON ad_spend(date);
CREATE INDEX idx_ad_spend_platform ON ad_spend(platform);

-- Auto-create income transactions from paid invoices (backfill)
-- Run this ONCE to sync Phase 3 invoice payments into transactions
INSERT INTO transactions (type, category, amount, description, invoice_id, contact_id, date, gst_applicable, gst_amount)
SELECT 
  'income',
  'mentorship_fee',
  total,
  'Invoice ' || invoice_number || ' payment',
  id,
  contact_id,
  COALESCE(paid_at::date, created_at::date),
  true,
  gst_amount
FROM invoices 
WHERE status = 'paid'
AND id NOT IN (SELECT invoice_id FROM transactions WHERE invoice_id IS NOT NULL);

-- Companies table (B2B support)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gst_number TEXT,
  address TEXT,
  state TEXT,
  website TEXT,
  industry TEXT,
  size TEXT CHECK (size IN ('1-10', '11-50', '51-200', '201-500', '500+')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Team member roles (upgrading from basic to RBAC)
ALTER TABLE team_members 
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'sales' 
    CHECK (role IN ('admin', 'sales', 'viewer')),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

-- Notification preferences per user
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  email_digest TEXT DEFAULT 'daily' CHECK (email_digest IN ('realtime', 'daily', 'weekly', 'off')),
  notify_new_lead BOOLEAN DEFAULT true,
  notify_task_due BOOLEAN DEFAULT true,
  notify_payment_received BOOLEAN DEFAULT true,
  notify_booking_created BOOLEAN DEFAULT true,
  notify_overdue_invoice BOOLEAN DEFAULT true,
  notify_weekly_summary BOOLEAN DEFAULT true,
  UNIQUE(user_id)
);

-- Insert default preferences for existing team members
INSERT INTO notification_preferences (user_id)
SELECT id FROM team_members
ON CONFLICT (user_id) DO NOTHING;
```

---

## Step 4: Auto-Sync Income Transactions

Going forward, every paid invoice should automatically create a transaction. Update the payment webhook handlers from Phase 3:

```
In src/app/api/webhooks/cashfree/route.ts and stripe/route.ts:

After marking invoice as paid, ADD:
  → Create transaction record:
    type: 'income'
    category: determine from invoice items (mentorship_fee, course_fee, etc.)
    amount: invoice.total
    invoice_id: invoice.id
    contact_id: invoice.contact_id
    date: payment date
    gst_applicable: true
    gst_amount: invoice.gst_amount

This ensures Finance module always has real-time income data.
```

---

## Phase 4 Build Order

### Week 1: Finance — Expenses + Revenue

```
1.  Expense entry form (src/components/finance/expense-form.tsx)
    → Fields:
      Date (date picker, default today)
      Category (dropdown from expense_categories table)
      Amount (₹ input, font-mono)
      Description (text)
      GST applicable (toggle — if yes, show GST amount input)
      Receipt upload (drag-drop or click, uploads to Supabase Storage)
      Attach to contact (optional — search/select)
    → On save: create transaction record with type 'expense'
    → Reference: ARCHITECTURE.md Section 6.7

2.  Expense list page (src/app/(app)/finance/expenses/page.tsx)
    → Data table: date, category, description, amount, GST, receipt
    → Filters: date range, category, has receipt
    → Sort: by date (default newest), by amount
    → Summary bar at top: total expenses this month, by top categories
    → Bulk actions: export selected as CSV
    → Receipt column: thumbnail if image, paperclip icon if PDF
      Click: opens receipt in modal/lightbox
    → Design: DESIGN_SYSTEM.md Section 4.5 (data table pattern)

3.  Finance overview page (src/app/(app)/finance/page.tsx)
    → This is the Finance module landing page
    → Top: date range picker (this month / last month / quarter / year / custom)
    → Summary cards (grid of 4):
      Total Revenue: sum of income transactions in period
      Total Expenses: sum of expense transactions in period
      Net Profit: revenue - expenses
      GST Liability: output GST (from invoices) - input GST (from expenses)
    → Revenue chart: line or bar chart, revenue by month (recharts)
    → Expense breakdown: horizontal bar chart by category
    → Recent transactions: last 10 income + expense entries, interleaved
    → Quick links: "Add Expense", "View P&L", "GST Summary"
    → Reference: ARCHITECTURE.md Section 6.7

4.  Revenue overview component (src/components/finance/revenue-overview.tsx)
    → Revenue by program: bar chart (Current, Ripple, Tide, Short Courses)
      Pulled from: invoices joined with customer_programs
    → Revenue by month: line chart, last 6-12 months
    → Top customers: table — name, total paid, program, last payment
    → Month-over-month growth: percentage with ↑ green or ↓ red indicator

5.  Ad spend tracker (src/app/(app)/finance/ad-spend/page.tsx)
    → Manual entry: date, platform, campaign name, amount, leads generated
    → Auto-import (if Meta API set up):
      "Import from Meta" button → fetches last 30 days of campaign spend
      Maps Meta campaign names to ad_spend records
    → Dashboard view:
      Total ad spend this month
      Cost per lead (CPL): total spend / total leads
      ROAS: revenue / ad spend
      CPL trend: line chart over time
      Per-campaign breakdown: table with spend, leads, CPL
    → Reference: ARCHITECTURE.md Section 6.7
```

### Week 2: Finance Reports + Export

```
6.  P&L report (src/app/(app)/finance/reports/pnl/page.tsx)
    → Date range selector: monthly / quarterly / yearly / custom
    → Report layout:

      INCOME
        Mentorship Fees         ₹X,XX,XXX
        Course Fees             ₹XX,XXX
        Other Income            ₹XX,XXX
        ────────────────────────────────
        Total Income            ₹X,XX,XXX

      EXPENSES
        Meta Ads                ₹XX,XXX
        Google Ads              ₹XX,XXX
        Software & Tools        ₹XX,XXX
        Salary & Contractors    ₹XX,XXX
        Office & Rent           ₹XX,XXX
        Other                   ₹XX,XXX
        ────────────────────────────────
        Total Expenses          ₹X,XX,XXX

        ════════════════════════════════
        NET PROFIT              ₹X,XX,XXX
        Profit Margin           XX%

    → Data source: transactions table grouped by type + category
    → Comparison mode: show previous period side-by-side
    → Export: "Download as Excel" button
    → Reference: ARCHITECTURE.md Section 6.7

7.  GST report (src/app/(app)/finance/reports/gst/page.tsx)
    → Period selector: monthly (for GSTR-1/3B filing)
    → Report layout:

      OUTPUT GST (from invoices)
        CGST Collected          ₹XX,XXX
        SGST Collected          ₹XX,XXX
        IGST Collected          ₹XX,XXX
        ────────────────────────────────
        Total Output            ₹XX,XXX

      INPUT GST (from expenses with GST)
        Total Input Credit      ₹XX,XXX

        ════════════════════════════════
        NET GST PAYABLE         ₹XX,XXX

    → Invoice-level detail: expandable section showing each invoice's GST
    → Export: CSV/XLSX formatted for CA to use during filing
    → Reference: ARCHITECTURE.md Section 6.7

8.  Revenue report (src/app/(app)/finance/reports/revenue/page.tsx)
    → Date range + group by: month / program / customer / source
    → Revenue by program: which programs generate the most revenue
    → Revenue by source: UTM-attributed revenue (which campaigns pay off)
    → Average deal size: total revenue / number of conversions
    → Revenue per salesperson: who's closing the most value
    → All sections: table + chart, exportable

9.  Export system (src/app/api/export/route.ts)
    → Accept: report type, date range, format (csv/xlsx)
    → Generate file using xlsx library
    → Return as downloadable file
    → Used by: P&L export, GST export, Revenue export, Expense export
    → Format for CA: clean column headers, rupee amounts, dates in DD/MM/YYYY
```

### Week 3: Analytics Module

```
10. Analytics overview page (src/app/(app)/analytics/page.tsx)
    → This is the comprehensive analytics dashboard
    → Date range picker at top (applies to all sections)
    → Grid layout of key metric cards with sparkline trends:
      Total Leads (period) — with trend vs previous period
      Conversion Rate — leads to customers
      Revenue (period) — with trend
      Avg Response Time — time from lead to first contact
      Email Open Rate — across all campaigns
      WhatsApp Read Rate — across all campaigns
    → Below: tabbed sections for deep dives (or link to sub-pages)
    → Reference: ARCHITECTURE.md Section 6.8

11. Lead analytics (src/app/(app)/analytics/leads/page.tsx)
    → Leads over time: line chart (daily/weekly/monthly granularity toggle)
    → Leads by source: bar chart
      source field from contacts — top 10 sources
    → Leads by UTM campaign: table
      utm_campaign + utm_source + utm_medium → leads count, booked count, converted count
    → Lead quality: pie/donut chart
      financially ready vs careful vs not ready (from form responses)
    → Urgency distribution: right now vs 90 days vs later
    → Data source: contacts table + contact_form_responses

12. Pipeline analytics (src/app/(app)/analytics/pipeline/page.tsx)
    → Funnel visualization: waterfall/funnel chart
      Shows each stage → next stage conversion percentage
      New Lead (100%) → Contacted (67%) → Booked (42%) → Done (33%) → Converted (8%)
    → Stage duration: bar chart showing average days per stage
      Identifies bottleneck: "Prospects spend avg 5 days in Contacted"
    → Drop-off analysis: where are you losing leads?
      Table: stage, entered count, exited count, lost count, lost %
    → Conversion trend: line chart, weekly/monthly conversion rate over time
    → Per-funnel selector: VSL Flow, Webinar Flow, etc.
    → Data source: contacts + activities (stage_change events with timestamps)

13. Communication analytics (src/app/(app)/analytics/communication/page.tsx)
    → Email performance: table of campaigns
      Columns: campaign name, sent, delivered, opened, clicked, bounced
      Open rate, click rate calculated
    → WhatsApp performance: table of campaigns
      Columns: campaign name, sent, delivered, read, replied
      Delivery rate, read rate calculated
    → Template leaderboard: which templates perform best
      Ranked by: open rate (email) or read rate (WhatsApp)
      "xw_book_24 has 78% read rate — your best performer"
    → Best send times: heatmap showing open/read rates by day + hour
      Helps optimize future campaign scheduling
    → Data source: email_sends + wa_sends tables

14. Team analytics (src/app/(app)/analytics/team/page.tsx)
    → Per-salesperson cards:
      Name, avatar
      Leads assigned (period)
      Contacts made (calls + messages)
      Conversion rate (their assigned leads → converted)
      Revenue closed
      Avg response time (lead created → first activity)
    → Comparison view: side-by-side columns or table
    → Activity volume chart: stacked bar, activities per person per week
    → Note: this becomes more useful when the third salesperson joins
    → Data source: contacts (assigned_to) + activities (user_id) + invoices
```

### Week 4: Full Dashboard + Team Management + Settings + Polish

```
15. Rebuild Dashboard (src/app/(app)/dashboard/page.tsx)
    → The Phase 1 dashboard showed basic stats. Now upgrade to comprehensive:
    
    STAT CARDS (row of 4 — same design, now with real trend data):
      New Leads: count today + sparkline showing last 7 days
      Follow-ups Due: count + overdue count in red
      Revenue This Month: ₹amount + % change vs last month (↑ green / ↓ red)
      Overdue Invoices: count + total ₹ amount
    
    TODAY'S FOCUS: same as Phase 1 but now includes:
      - Overdue invoices: "₹17,700 overdue from Sameer — 5 days past due"
      - Subscription renewals: "Mohit's monthly renewal due tomorrow"
      - Financial: items from invoice system
    
    PIPELINE HEALTH: now with real conversion percentages
      Mini funnel with live data
    
    NEW SECTIONS:
      Revenue mini-chart: sparkline of last 30 days revenue
      Team summary (if 2+ salespeople):
        Murad: 8 leads, 2 converted | Almas: 6 leads, 1 converted
      Communication pulse: emails sent / WA sent this week with open/read rates
    
    RECENT ACTIVITY: same as Phase 1, now with financial activities too
      "Payment received ₹15,000 from Prakash" appears here
    
    → Reference: PAGE_LAYOUTS.md Section 1 (Dashboard layout)
    → Reference: ARCHITECTURE.md Section 6.8

16. Team management (src/app/(app)/settings/team/page.tsx)
    → List of team members as cards:
      Avatar + name + email + role badge (Admin/Sales/Viewer)
      Status: active (green dot) / inactive (gray)
      Last active: relative time
      Actions: change role, deactivate, remove
    → "Invite Team Member" button:
      Modal: email address + role selector (Admin/Sales/Viewer)
      On invite: create Supabase Auth account, send invite email
      New member appears with "Invited" status until they log in
    → Role permissions:
      Admin: full access to everything
      Sales: prospects, customers, communication, calendar, invoices (own)
      Viewer: read-only access to dashboard and analytics
    → Note: RBAC enforcement should be at the API level
      using Supabase Row Level Security + middleware role checks

17. Integrations page (src/app/(app)/settings/integrations/page.tsx)
    → Grid of integration cards:
    
    Each card:
      Logo/icon + service name + description
      Status indicator:
        Connected: green dot + "Connected as murad@..." + last sync time
        Not connected: gray + "Set up" CTA button
        Error: red dot + "Reconnect" button
    
    Integrations:
      Google Calendar — connected/not per team member
      WhatsApp Cloud API — show number + template count
      Resend (Email) — show domain verification status
      Cashfree — show connection status + test mode indicator
      Stripe — show connection status
      Meta Ads (optional) — show ad account ID if connected
    
    Each card expand/click: shows config details
      API key (masked: •••••••xxxx), webhook URL, test button

18. Notification preferences (src/app/(app)/settings/notifications/page.tsx)
    → Email digest frequency: dropdown (Real-time / Daily / Weekly / Off)
    → Toggle list:
      □ New lead arrives
      □ Task due today
      □ Task overdue
      □ Payment received
      □ New booking
      □ Invoice overdue
      □ Weekly analytics summary
    → "Save Preferences" button
    → Per-user: saves to notification_preferences table

19. Weekly analytics email (src/app/api/cron/weekly-analytics/route.ts)
    → Inngest cron: runs Monday 8 AM
    → Generates and sends email to all team members with notify_weekly_summary = true
    → Content:
      Last week: X new leads, X conversions, ₹X revenue
      Pipeline: X prospects in pipeline, X overdue follow-ups
      Communication: X emails sent (Y% open rate), X WA sent (Z% read rate)
      Top performer: "Murad closed ₹45,000 this week"
      Action items: overdue tasks count, overdue invoices count
    → Use React Email template for formatting
    → Send via Resend

20. Update sidebar: enable Phase 4 modules
    → In constants.ts: change CURRENT_PHASE to 4
    → Finance and Analytics nav items become active
    → All "Coming Soon" badges are now gone — full system is live 🎉

21. Data backfill verification
    → Verify: all historical invoices have corresponding transaction records
    → Verify: analytics queries return correct data for past months
    → Verify: P&L report matches manual accounting records
    → Ask your CA to review one month's GST report vs their records
    → Fix any discrepancies before relying on the data

22. Performance optimization
    → Add database indexes for analytics queries:
      CREATE INDEX idx_contacts_created ON contacts(created_at);
      CREATE INDEX idx_contacts_source ON contacts(source);
      CREATE INDEX idx_activities_type_created ON activities(type, created_at);
      CREATE INDEX idx_invoices_status_paid ON invoices(status, paid_at);
    → Consider Supabase database views for complex analytics:
      CREATE VIEW monthly_revenue AS ...
      CREATE VIEW pipeline_conversion AS ...
    → Recharts can be heavy — use dynamic imports:
      const Chart = dynamic(() => import('@/components/analytics/revenue-chart'), { ssr: false })

23. Final testing + go live
    → Test every analytics page with real data
    → Test export: download P&L as Excel, verify formatting
    → Test team invite: invite a test account, verify login + permissions
    → Test weekly email: trigger manually, verify content + formatting
    → Run npm run build — fix all TypeScript errors
    → Mobile check: finance pages readable on phone (tables scroll)
    → Deploy to production
    → Remove accounting person (₹1,000/month saved — final tool eliminated)
    → SalesHub is feature-complete 🚀
```

---

## Week-by-Week Summary

| Week | Focus | Deliverable |
|------|-------|-------------|
| **1** | Expenses + Revenue overview + Ad spend tracker | Track all money in and out, see revenue by program |
| **2** | P&L, GST, Revenue reports + Export | Generate reports for tax filing, download as Excel |
| **3** | Analytics module (leads, pipeline, comms, team) | Data-driven insights across all modules |
| **4** | Full Dashboard rebuild + Team mgmt + Settings + Polish | Comprehensive morning dashboard, team roles, all integrations configured |

---

## How to Use Claude for Phase 4 Building

### Example Prompts

**P&L Report:**
> "I'm building SalesHub Phase 4. Build the P&L report page at src/app/(app)/finance/reports/pnl/page.tsx. Reference: docs/PHASE4_SETUP.md Step 6 and docs/ARCHITECTURE.md Section 6.7. It needs a date range picker (monthly/quarterly/yearly/custom), income section grouped by category from transactions table, expenses section grouped by category, net profit calculation, and a 'Download as Excel' button. Use recharts for a comparison bar chart (this period vs last period). Follow docs/DESIGN_SYSTEM.md Horizon palette."

**Funnel Analytics:**
> "Build the pipeline analytics page at src/app/(app)/analytics/pipeline/page.tsx. Reference: docs/PHASE4_SETUP.md Step 12. It needs: a funnel visualization showing conversion % between each stage (use recharts FunnelChart or a custom SVG), an average-time-per-stage bar chart, a drop-off analysis table, and a per-funnel selector dropdown. Data comes from contacts joined with activities where type='stage_change' to calculate time between stages. Follow docs/DESIGN_SYSTEM.md."

**Team Management:**
> "Build the team management page at src/app/(app)/settings/team/page.tsx. Reference: docs/PHASE4_SETUP.md Step 16. Show team members as cards with avatar, name, email, role badge (Admin/Sales/Viewer), active status, and last active time. 'Invite Team Member' button opens a modal with email + role selector. On invite: create Supabase Auth user and send invite email. Implement role-based access: Admin=full, Sales=own data, Viewer=read only. Use shadcn/ui components."

---

## Post-Phase 4: What's Next?

SalesHub is feature-complete after Phase 4. But here are natural extensions you might want later:

- **Mobile app:** React Native wrapper or PWA for on-the-go access
- **AI lead scoring:** Auto-rank leads by likelihood to convert based on form responses + behavior
- **WhatsApp chatbot:** Auto-respond to incoming messages with basic info
- **Multi-brand support:** If Xperience Wave launches sub-brands or sister companies
- **Advanced RBAC:** Fine-grained permissions (can view but not edit invoices, etc.)
- **Audit log:** Full trail of who changed what, when (important for compliance)
- **API for landing pages:** Let multiple landing pages push leads with different funnels
- **Zapier/webhook integration:** Let external tools push data into SalesHub

These are all additive — the core architecture supports them without restructuring.

---

## Important Reminders

- **Backfill transactions data** before trusting Finance numbers — run the migration query in Step 3
- **Have your CA audit the GST report** before relying on it for filing
- **Analytics queries can be slow** on large datasets — add indexes proactively
- **Team roles need API-level enforcement** — don't rely on hiding UI elements alone
- **The weekly email is your engagement tool** — if the team stops opening SalesHub daily, the weekly email brings them back
- **Export formatting matters** — your CA will judge the tool by how clean the Excel export looks
- **After Phase 4, spend 1-2 weeks just using it** — find the rough edges before adding anything new

---

*Reference documents:*
- *ARCHITECTURE.md — Database schema (Section 5), Module specs (Section 6.7, 6.8, 6.9), Background jobs (Section 7.6)*
- *DESIGN_SYSTEM.md — Visual language, component specs, chart styling*
- *PAGE_LAYOUTS.md — Dashboard layout (Section 1)*
- *LAYOUTS_PHASE4.md — [To be created if full page layouts are needed]*

*Last updated: February 26, 2026*
