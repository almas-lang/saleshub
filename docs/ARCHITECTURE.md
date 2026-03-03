# SALESHUB — Architecture & Build Guide

> **Xperience Wave — Unified Sales & Marketing Platform**
> **Prepared for:** Shaik Murad & Almas
> **Date:** February 25, 2026 | **Version:** 1.0
> **CONFIDENTIAL — Internal Use Only**

---

## Table of Contents

1. Executive Summary
2. System Overview & Module Map
3. Navigation & Information Architecture
4. Tech Stack
5. Database Schema
6. Module Specifications
   - 6.1 Prospects (CRM)
   - 6.2 Communication Hub (WhatsApp + Email)
   - 6.3 Calendar & Booking
   - 6.4 Funnels & Pipelines
   - 6.5 Customers
   - 6.6 Estimates & Invoices
   - 6.7 Taxes & Bookkeeping
   - 6.8 Analytics & Dashboards
   - 6.9 Profile & Settings
7. API Design & Integrations
8. Data Migration Plan
9. Phased Build Plan
10. Cost Analysis
11. Key Decisions & Trade-offs
12. Risk Mitigation

---

## 1. Executive Summary

SalesHub is a custom-built, unified sales and marketing platform for Xperience Wave (Expwave OPC Private Limited). It replaces a fragmented 8-tool tech stack with a single responsive web application that provides complete lead-to-customer visibility, automated follow-ups, integrated communication, and financial management.

### The Problem

- No unified view of a lead's complete journey — data scattered across Brevo, Google Sheets, AiSensy, Calendly
- Missing follow-ups due to no automated reminders or task system
- Excessive manual work: data entry across tools, invoice generation, sheet updates
- Paying for 8+ separate tools (~₹15,000/month excluding ads) with overlapping functionality
- Cannot scale — adding a third salesperson would multiply the chaos

### The Solution

A phased build of SalesHub that gradually replaces existing tools while maintaining operations. Each phase delivers immediate value. The full system handles: lead capture, pipeline management, WhatsApp & email automation, calendar booking, invoicing, payments, bookkeeping, and analytics.

### Key Numbers

| Metric | Current | After SalesHub |
|--------|---------|----------------|
| Monthly tool cost (excl. ads) | ₹~15,000 | ₹~6,100–8,100 |
| Number of tools | 8–10 | 1 (+ Meta Ads + Workspace) |
| Lead visibility | Fragmented across tools | 100% unified view |
| Follow-up tracking | Manual / memory-based | Automated reminders |
| Est. time saved/week | — | 15–20 hours |

### Team

- **Shaik Murad** — Product owner, admin, salesperson
- **Almas** — Primary developer (with Claude AI assistance), salesperson
- **Future:** 1 additional salesperson (Q1 2026)

---

## 2. System Overview & Module Map

SalesHub is organized into 10 modules. The navigation is designed to accommodate all modules from day one, even though some will be built in later phases. Greyed-out modules in the sidebar will show a "Coming Soon" state.

### Module Overview

| # | Module | Purpose | Replaces |
|---|--------|---------|----------|
| 1 | **Dashboard** | Morning overview: leads, revenue, follow-ups due, pipeline health | Nothing (new) |
| 2 | **Prospects** | Lead database, pipeline tracking, follow-up management, lead assignment | Google Sheets |
| 3 | **Customers** | Post-sale management: mentorship tracking, renewals, B2B accounts | Google Sheets |
| 4 | **Communication** | WhatsApp + Email: campaigns, drip sequences, templates, message history | Brevo + AiSensy + Pabbly |
| 5 | **Calendar** | Booking pages, availability, Google Calendar sync, event management | Calendly |
| 6 | **Funnels** | Define & manage pipeline templates per sales type (VSL, webinar, etc.) | Nothing (new) |
| 7 | **Invoices** | GST invoices, estimates, payment collection (Cashfree + Stripe) | Accounting person |
| 8 | **Finance** | Revenue tracking, expense management, P&L, tax/ITR preparation | Manual accounting |
| 9 | **Analytics** | Deep analytics across all modules: funnel conversion, email/WA metrics, ROI | Nothing (new) |
| 10 | **Settings** | Profile, team management, business config, integrations, notifications | N/A |

---

## 3. Navigation & Information Architecture

The app uses a left sidebar navigation pattern, consistent across all screen sizes (collapsible on mobile). All 10 modules are present in the sidebar from day one. Modules not yet built show a "Coming Soon" badge and are non-clickable but visible — this sets user expectations and ensures the navigation never needs restructuring.

### Sidebar Structure

The sidebar is organized into logical groups with visual separators:

**Group 1: Overview**
- **Dashboard** — Home/landing page after login. Summary cards, charts, action items.

**Group 2: Sales**
- **Prospects** — All leads, pipeline views (Kanban + list), filters, search, bulk actions
- **Customers** — Converted customers, mentorship tracking, company accounts
- **Funnels** — Pipeline templates, stage definitions per sales type

**Group 3: Communicate**
- **WhatsApp** — Campaigns, drip sequences, templates, conversation history
- **Email** — Campaigns, drip sequences, newsletters, templates, send history
- **Calendar** — Booking pages, events, Google Calendar sync

**Group 4: Money**
- **Invoices** — Estimates, invoices, payment links, payment tracking
- **Finance** — Revenue, expenses, P&L, tax preparation

**Group 5: Insights**
- **Analytics** — Cross-module reporting, funnel analysis, ROI tracking

**Bottom: System**
- **Settings** — Profile, team, business config, integrations, notifications

### Key Navigation Principles

1. Every contact (prospect or customer) has a single, unified profile page accessible from any module — clicking a name anywhere opens the same detail view.
2. Prospect and Customer detail pages have tabs: Overview, Communication (all WhatsApp + email history), Bookings, Invoices, Notes, Activity Log.
3. Global search bar at the top searches across all contacts, invoices, and communications.
4. Notification bell icon in the top bar shows unread alerts (new leads, follow-ups due, payments received).
5. Quick actions button ("+") always visible: Add Prospect, Send Message, Create Invoice, Book Meeting.

---

## 4. Tech Stack

Chosen for: developer experience with Claude AI assistance, cost efficiency, scalability for 3–5 users and 10,000+ contacts, and strong ecosystem support.

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | **Next.js 14+ (App Router)** | Full-stack React. Server components for speed. API routes for backend. Deploys on Vercel. |
| Styling | **Tailwind CSS + shadcn/ui** | Utility-first CSS. shadcn provides production-ready components (tables, modals, forms, etc.). Reduces UI dev time by 50%+. |
| Database | **Supabase (PostgreSQL)** | Free tier: 500MB + 50K monthly active users. Built-in auth, realtime subscriptions, storage. Row-level security for future multi-user. |
| Auth | **Supabase Auth** | Email/password login. Easy to add role-based access (admin/sales/marketing) later. No separate auth service needed. |
| WhatsApp | **Meta Cloud API (direct)** | You already have access. No middleman. Send templates, receive webhooks. ~₹0.30–0.80/conversation vs AiSensy's markup. |
| Email Sending | **Resend** | Free: 3K/mo but 100/day limit. Pro: $20/mo (~₹1,700) for 50K emails, no daily limit. Built-in analytics (opens, clicks). Custom domain support. |
| Payments | **Cashfree + Stripe** | Cashfree for Indian payments (existing), Stripe for international. Both have subscription APIs. 2–2.5% per transaction. |
| Calendar | **Google Calendar API** | Direct sync with your existing Google Workspace calendars. Free. |
| File Storage | **Supabase Storage** | Voice notes, documents, invoice PDFs. 1GB free, then ₹20/GB/month. |
| Hosting | **Vercel** | You already use Vercel for xperiencewave.com. Add app.xperiencewave.com as a subdomain. Free tier likely sufficient. |
| Background Jobs | **Vercel Cron + Inngest** | For drip sequence scheduling, follow-up reminders, daily digest emails. Inngest free tier: 25K events/month. |
| PDF Generation | **React-PDF or jsPDF** | Generate GST-compliant invoices as downloadable PDFs. No external service needed. |

### Monthly Infrastructure Cost Estimate

| Service | Free Tier | At Scale (1000+ leads/mo) |
|---------|-----------|--------------------------|
| Vercel (hosting) | Free | ₹1,500/mo (Pro) |
| Supabase (DB + Auth + Storage) | Free | ₹2,100/mo ($25 Pro) |
| Resend (email) | Free (100/day limit) | ₹1,700/mo ($20 Pro) |
| WhatsApp Cloud API | 1,000 free/mo | ~₹500–1,000/mo |
| Inngest (background jobs) | Free (25K events) | Free (likely sufficient) |
| Domain (app.xperiencewave.com) | Free (subdomain) | Free |
| **TOTAL** | **₹0/mo** | **₹5,300–6,300/mo** |

---

## 5. Database Schema

PostgreSQL on Supabase. All tables use UUID primary keys, created_at/updated_at timestamps, and soft-delete (deleted_at). The schema is designed for the full system from day one — tables for later phases are created empty and populated when those modules are built.

### Core Tables

#### contacts

The central table. Every person (prospect or customer) lives here. Single source of truth.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| type | ENUM | 'prospect' \| 'customer' \| 'lead' — changes on conversion |
| account_type | ENUM | 'individual' \| 'business' — for future B2B support |
| first_name | TEXT | Required |
| last_name | TEXT | Optional |
| email | TEXT | Unique, indexed |
| phone | TEXT | With country code, indexed |
| linkedin_url | TEXT | From Calendly form |
| source | TEXT | e.g., 'ld-home-popup', 'webinar-jan-2026', 'direct-outreach' |
| utm_source | TEXT | From landing page |
| utm_medium | TEXT | From landing page |
| utm_campaign | TEXT | From landing page |
| utm_content | TEXT | From landing page |
| utm_term | TEXT | From landing page |
| assigned_to | UUID (FK) | References team_members.id |
| funnel_id | UUID (FK) | Which funnel/pipeline they're in |
| current_stage_id | UUID (FK) | Current stage in the funnel |
| tags | TEXT[] | Array of tags for flexible categorization |
| company_name | TEXT | For B2B contacts |
| company_id | UUID (FK) | For B2B: references companies table (Phase 4+) |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto on change |
| converted_at | TIMESTAMP | When prospect became customer |
| deleted_at | TIMESTAMP | Soft delete |

#### contact_form_responses

Stores the Calendly-replacement form answers (the 10-question qualifying form) as structured, filterable data.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| contact_id | UUID (FK) | References contacts.id |
| booking_id | UUID (FK) | References bookings.id (the call they booked) |
| work_experience | ENUM | 'fresher' \| '<2_years' \| '3-5_years' \| '5-10_years' \| '10+_years' |
| current_role | TEXT | Free text |
| key_challenge | TEXT | Selected challenge option |
| desired_salary | TEXT | Free text |
| blocker | TEXT | What's stopping them (free text, long) |
| financial_readiness | ENUM | 'ready' \| 'careful_but_open' \| 'not_ready' |
| urgency | ENUM | 'right_now' \| 'within_90_days' \| 'more_than_90_days' |
| created_at | TIMESTAMP | When form was submitted |

#### funnels

Pipeline templates. Each sales type (VSL, webinar, workshop, etc.) can have its own funnel with different stages.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | TEXT | e.g., 'VSL Lead Magnet Flow', 'Webinar Flow' |
| description | TEXT | Optional |
| sales_type | ENUM | 'vsl' \| 'webinar' \| 'workshop' \| 'short_course' \| 'direct_outreach' \| 'custom' |
| is_default | BOOLEAN | The default funnel for new leads |
| is_active | BOOLEAN | Can be deactivated without deleting |
| created_at | TIMESTAMP | |

#### funnel_stages

Stages within a funnel. Order determines the pipeline sequence.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| funnel_id | UUID (FK) | References funnels.id |
| name | TEXT | e.g., 'New Lead', '121 Booked', 'Converted' |
| order | INT | Display order (1, 2, 3...) |
| color | TEXT | Hex color for Kanban card |
| is_terminal | BOOLEAN | True for 'Converted', 'Lost', 'Rejected' etc. |
| auto_action | JSONB | Optional: trigger automation when contact enters this stage |

#### activities

Universal activity log. Every action on a contact is recorded here — this is what populates the timeline view on a contact's profile.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| contact_id | UUID (FK) | Who this activity is about |
| user_id | UUID (FK) | Who performed the action (Murad, Almas, system) |
| type | ENUM | 'note' \| 'call' \| 'email_sent' \| 'email_opened' \| 'wa_sent' \| 'wa_delivered' \| 'wa_read' \| 'stage_change' \| 'booking_created' \| 'payment_received' \| 'invoice_sent' \| 'form_submitted' |
| title | TEXT | Short description: 'Moved to 121 Booked' |
| body | TEXT | Longer content: call notes, email body, etc. |
| metadata | JSONB | Flexible: {from_stage, to_stage}, {email_id}, {amount}, etc. |
| created_at | TIMESTAMP | When it happened |

#### tasks

Follow-up reminders and action items. This is the table that prevents missed follow-ups.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| contact_id | UUID (FK) | Related contact (optional) |
| assigned_to | UUID (FK) | Who should do this |
| title | TEXT | 'Follow up with Sameer about mentorship pricing' |
| description | TEXT | Optional details |
| due_at | TIMESTAMP | When this is due |
| priority | ENUM | 'low' \| 'medium' \| 'high' \| 'urgent' |
| status | ENUM | 'pending' \| 'completed' \| 'overdue' \| 'cancelled' |
| type | ENUM | 'follow_up' \| 'call' \| 'email' \| 'general' |
| completed_at | TIMESTAMP | When marked done |
| created_at | TIMESTAMP | |

### Communication Tables

#### email_campaigns

Both one-time mass emails and drip sequences.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | TEXT | '7-Day VSL Follow-up Sequence' |
| type | ENUM | 'drip' \| 'one_time' \| 'newsletter' |
| status | ENUM | 'draft' \| 'active' \| 'paused' \| 'completed' |
| trigger_event | TEXT | What starts this: 'lead_created', 'manual', etc. |
| stop_condition | JSONB | e.g., {event: 'booking_created'} — stops drip when they book |
| audience_filter | JSONB | Which contacts to include (by tag, source, funnel, etc.) |
| created_at | TIMESTAMP | |

#### email_steps

Individual emails within a drip campaign, with delay and conditions.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| campaign_id | UUID (FK) | Parent campaign |
| order | INT | Step number (1, 2, 3...) |
| delay_hours | INT | Hours to wait after previous step (0 for first step) |
| subject | TEXT | Email subject (supports {{first_name}} variables) |
| body_html | TEXT | Email body HTML (supports variables) |
| condition | JSONB | Optional: only send if {email_opened: true} or {link_clicked: true} |
| template_id | UUID (FK) | Optional: use a saved template |

#### email_sends

Individual email delivery records with tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| contact_id | UUID (FK) | Recipient |
| campaign_id | UUID (FK) | Which campaign |
| step_id | UUID (FK) | Which step in the sequence |
| status | ENUM | 'queued' \| 'sent' \| 'delivered' \| 'opened' \| 'clicked' \| 'bounced' \| 'failed' |
| resend_message_id | TEXT | Resend API message ID for tracking |
| opened_at | TIMESTAMP | First open time |
| clicked_at | TIMESTAMP | First click time |
| sent_at | TIMESTAMP | When sent |

#### wa_campaigns + wa_steps + wa_sends

Mirror the email tables structure exactly. Additional fields: wa_template_name (approved Meta template), wa_template_params (dynamic variables). wa_sends also track: delivered_at, read_at, replied (boolean).

### Booking & Calendar Tables

#### booking_pages

Calendly replacement. Each booking page has its own URL, duration, form fields, and availability rules.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| slug | TEXT | URL path: app.xperiencewave.com/book/{slug} |
| title | TEXT | 'Design Career Strategy Call with XW Team' |
| description | TEXT | Shown on the booking page |
| duration_minutes | INT | 45 (matching your current Calendly setup) |
| form_fields | JSONB | Array of form field definitions (the 10 questions) |
| availability_rules | JSONB | Days, hours, buffer between meetings, max per day |
| google_calendar_id | TEXT | Which Google Calendar to check/create events in |
| assigned_to | UUID[] | Team members whose calendars to check |
| confirmation_email | BOOLEAN | Auto-send confirmation? |
| confirmation_wa | BOOLEAN | Auto-send WhatsApp confirmation? |
| is_active | BOOLEAN | |

#### bookings

Individual booked meetings.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| booking_page_id | UUID (FK) | Which booking page was used |
| contact_id | UUID (FK) | Who booked |
| assigned_to | UUID (FK) | Which team member is hosting |
| starts_at | TIMESTAMP | Meeting start |
| ends_at | TIMESTAMP | Meeting end |
| status | ENUM | 'confirmed' \| 'cancelled' \| 'completed' \| 'no_show' |
| google_event_id | TEXT | Google Calendar event ID for sync |
| meet_link | TEXT | Google Meet URL (auto-generated) |
| notes | TEXT | Post-call notes by salesperson |
| outcome | ENUM | 'qualified' \| 'not_qualified' \| 'needs_follow_up' \| 'converted' |
| created_at | TIMESTAMP | |

### Financial Tables

#### invoices

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| invoice_number | TEXT | Auto-generated: XW-2026-001 (sequential) |
| contact_id | UUID (FK) | Customer |
| type | ENUM | 'estimate' \| 'invoice' |
| status | ENUM | 'draft' \| 'sent' \| 'paid' \| 'overdue' \| 'cancelled' |
| items | JSONB | Line items: [{description, qty, rate, amount, sac_code}] |
| subtotal | DECIMAL | Before tax |
| gst_rate | DECIMAL | 18% typically |
| gst_amount | DECIMAL | Calculated |
| total | DECIMAL | Final amount |
| gst_number | TEXT | Business GST number |
| due_date | DATE | Payment due date |
| payment_gateway | ENUM | 'cashfree' \| 'stripe' \| 'manual' |
| payment_link | TEXT | Generated payment URL |
| payment_id | TEXT | Gateway transaction ID |
| paid_at | TIMESTAMP | When payment was confirmed |
| is_recurring | BOOLEAN | Monthly subscription invoices |
| recurrence_day | INT | Day of month to generate (1-28) |
| pdf_url | TEXT | Stored invoice PDF |
| created_at | TIMESTAMP | |

#### transactions (Phase 4: Finance module)

Tracks all money in and out. Populated by payment webhooks + manual expense entry.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| type | ENUM | 'income' \| 'expense' |
| category | TEXT | 'mentorship_fee' \| 'ads_spend' \| 'tools' \| 'salary' \| etc. |
| amount | DECIMAL | |
| description | TEXT | |
| invoice_id | UUID (FK) | Linked invoice (for income) |
| contact_id | UUID (FK) | Related contact (for income) |
| date | DATE | Transaction date |
| gst_applicable | BOOLEAN | |
| receipt_url | TEXT | Uploaded receipt/proof |
| created_at | TIMESTAMP | |

#### Other tables (created in schema, built later)

- **team_members** — Users of SalesHub (id, name, email, role, avatar, google_calendar_id)
- **email_templates** — Reusable email templates with subject + body_html
- **wa_templates** — Mirrors approved Meta templates for easy selection
- **notifications** — In-app notifications (user_id, title, body, read, link, created_at)
- **companies** — For B2B: company_name, gst_number, contacts[], etc. (Phase 4+)
- **customer_programs** — Tracks mentorship/program enrollment per customer
- **files** — Voice notes, documents attached to contacts

---

## 6. Module Specifications

Detailed spec for each module. Build only what's in the specified phase — but the navigation slot and database tables exist from day one.

### 6.1 Prospects (CRM) — Phase 1

The heart of SalesHub. This is what replaces Google Sheets and gives you the unified lead view.

**Views:**

1. **List View (default):** Sortable, filterable table of all prospects. Columns: Name, Phone, Email, Source, Funnel Stage, Assigned To, Last Activity, Created. Bulk actions: assign, tag, move stage, delete.
2. **Kanban View:** Drag-and-drop cards across funnel stages. Each card shows: name, phone, last activity date, urgency indicator (red if no contact in 3+ days). Switching between funnels via dropdown.
3. **Contact Detail Page:** Full profile with tabs — Overview (all key info + form responses), Timeline (all activities chronologically), Communication (all emails + WhatsApp), Bookings, Invoices, Notes.

**Features:**

- **Auto-capture:** Webhook endpoint receives leads from landing page (ld.xperiencewave.com). Lead appears instantly in pipeline.
- **Quick add:** Manual lead entry with minimal fields (name + phone/email).
- **Follow-up system:** When viewing a contact, click "Schedule Follow-up" to create a task with due date. Tasks appear in Dashboard and trigger notifications.
- **Smart filters:** Filter by source, funnel, stage, tag, assigned_to, date range, form responses (e.g., "show all financially ready leads from last 7 days").
- **Stage automation:** Moving a contact to "Converted" auto-prompts to convert to Customer and optionally generate an invoice.
- **Import:** CSV/XLSX upload to bulk import your existing 3,252 leads.

### 6.2 Communication Hub — Phase 2

**WhatsApp (replaces AiSensy + Pabbly):**

- **Template management:** View and use your existing 15+ approved templates (xw_vsl_start, xw_book_24, etc.). Submit new templates for approval from within SalesHub.
- **Campaign builder:** Select audience (by filter/tag/funnel stage), choose template, schedule or send immediately.
- **Drip sequences:** Multi-step WhatsApp sequences with delays. Stop condition support (e.g., stop when they book a call).
- **Conversation view:** See all WhatsApp message history per contact. Incoming messages via webhook appear in real-time.
- **Quick send:** From any contact profile, send a template message in 2 clicks.

**Email (replaces Brevo):**

- **Campaign builder:** Rich text editor for email body. Variable support ({{first_name}}, {{company}}, etc.).
- **Drip sequences:** Your current 7-day conditional flow, rebuilt with visual builder. Conditions: opened, clicked, booked, time-based.
- **Newsletter:** One-time mass send to filtered audience.
- **Analytics:** Opens, clicks, bounces per campaign and per email. Tracked via Resend webhooks.
- **Templates:** Save and reuse email templates.
- **Send from:** team@xperiencewave.com (requires DNS setup: SPF, DKIM, DMARC records in Vercel).

### 6.3 Calendar & Booking — Phase 2

Replaces Calendly. Public booking page at app.xperiencewave.com/book/{slug}.

- **Booking page builder:** Title, description, duration, form fields (replicate your current 10-question form), availability rules.
- **Availability engine:** Checks Google Calendar for conflicts. Supports buffer time between meetings, max meetings per day, blocked dates.
- **Multi-host:** Round-robin or specific assignment (Murad or Almas based on availability).
- **Auto-actions on booking:** Create contact (if new), move to "121 Booked" stage, send confirmation email + WhatsApp, create Google Calendar event with Meet link.
- **Embeddable:** Generate an iframe code to embed on ld.xperiencewave.com (replacing Calendly embed).

### 6.4 Funnels & Pipelines — Phase 1

- **Create funnel templates:** Define stages, order, colors, and terminal states.
- **Pre-built defaults:** VSL Flow (Lead → Contacted → 121 Booked → 121 Done → Proposal Sent → Converted / Lost), Webinar Flow (Registered → Attended → Interested → Converted / Lost).
- **Customizable:** Add, remove, reorder stages at any time. Existing contacts stay in their current stage.
- **Stage rules:** Optional auto-actions per stage (e.g., entering "Converted" triggers invoice creation).

### 6.5 Customers — Phase 3

Separate view from Prospects with different information architecture.

- **Customer profile:** Same unified contact page, but with additional tabs: Programs (mentorship enrollment), Payments (all invoices + payment history), Renewals.
- **Program tracking:** Which program they bought, start date, sessions completed, next session, mentor assigned.
- **Renewal alerts:** For subscription customers, auto-task created 7 days before renewal. Auto-generate invoice 1 day before.
- **Company accounts (future):** Group multiple contacts under a company. Company-level invoicing.

### 6.6 Invoices — Phase 3

- **Invoice builder:** Line items, GST auto-calculation (CGST + SGST or IGST based on state), SAC codes, sequential numbering.
- **Estimates:** Same format, convertible to invoice with one click.
- **Payment integration:** Generate Cashfree/Stripe payment link from invoice. Link sent via email + WhatsApp. Auto-mark as paid via webhook.
- **Recurring invoices:** Set up monthly auto-generation for subscription customers. Sends payment link automatically.
- **PDF generation:** Professional invoice PDF (downloadable, emailable) with XW branding, GST details, digital signature placeholder.

### 6.7 Finance — Phase 4

- **Revenue dashboard:** Total revenue, month-over-month, by program, by customer.
- **Expense tracking:** Manual entry of expenses with category, receipt upload, GST input credit tracking.
- **P&L report:** Auto-generated from income (invoices marked paid) and expenses. Monthly, quarterly, yearly views.
- **Tax preparation:** GST summary (output tax from invoices, input tax from expenses). Data export for CA/tax filing.
- **Ad spend tracking:** Manual or API-based (Meta Ads API) import of ad costs for ROI calculation.

### 6.8 Analytics — Phase 4

The morning dashboard you want. Cross-module analytics:

- **Leads:** Generated today/this week/this month, by source, by campaign (UTM tracking)
- **Pipeline:** Conversion rate per stage, average time in each stage, funnel drop-off analysis
- **Communication:** Emails sent/opened/clicked rates, WhatsApp delivered/read rates, best performing templates
- **Revenue:** Total collected, pending, overdue. Per program, per month.
- **Expenses:** Total spent, by category. Ad spend vs. revenue (ROAS).
- **Team:** Leads per salesperson, conversion rates per person, response time

### 6.9 Settings — Built incrementally

- **Profile:** Business name (Expwave OPC Pvt Ltd), logo, GST number, address, support email
- **Team:** Add/remove team members, assign roles (admin/sales — future: marketing, viewer)
- **Integrations:** Google Calendar connection, Meta WhatsApp API config, Resend API key, Cashfree/Stripe API keys
- **Notification preferences:** Email digest frequency, in-app notification types
- **Email config:** Sending domain verification (SPF/DKIM), default sender name

---

## 7. API Design & Integrations

SalesHub needs to communicate with several external services. Here's how each integration works:

### 7.1 Landing Page → SalesHub (Lead Capture)

**Current flow:** Landing page → Brevo + Pabbly → Google Sheets + AiSensy
**New flow:** Landing page → SalesHub webhook → Everything happens automatically

**Endpoint:** `POST /api/webhooks/lead-capture`

The landing page (ld.xperiencewave.com) will POST form data (name, email, phone, source, UTM params) to this endpoint. SalesHub will: (1) Create contact in database, (2) Assign to default VSL funnel at "New Lead" stage, (3) Enroll in WhatsApp drip sequence, (4) Enroll in email drip sequence, (5) Log activity. This single webhook replaces Brevo capture + Pabbly automation + GSheet update.

### 7.2 WhatsApp Cloud API

**Base URL:** `https://graph.facebook.com/v18.0/{phone-number-id}/messages`

Authentication: System user token from Meta Business Manager. SalesHub sends template messages and receives delivery/read receipts + incoming messages via webhook. Your existing number (+91 80508 08950) and templates continue working — just connected to SalesHub instead of AiSensy.

**Webhook:** `POST /api/webhooks/whatsapp` — receives message status updates and incoming messages.

### 7.3 Resend (Email)

Simple REST API. Send emails, receive webhooks for delivery/open/click events. Custom domain sending (team@xperiencewave.com) requires adding DNS records.

**Webhook:** `POST /api/webhooks/email` — receives open, click, bounce, delivery events.

### 7.4 Google Calendar API

OAuth2 connection per team member. SalesHub reads free/busy data for booking page availability, creates events when bookings are confirmed, and deletes/updates events on cancellation. Google Meet links are auto-generated with each event.

### 7.5 Payment Gateways

Cashfree and Stripe both support: (1) Payment link generation via API, (2) Webhook on payment success/failure, (3) Subscription management. When payment is confirmed, SalesHub auto-marks the invoice as paid, logs an activity on the contact, and optionally triggers a WhatsApp confirmation message.

**Webhooks:** `POST /api/webhooks/cashfree` and `POST /api/webhooks/stripe`

### 7.6 Background Jobs (Inngest)

Scheduled tasks that run automatically:

- **Every hour:** Process drip sequence queue (check which contacts need next email/WhatsApp)
- **Every hour:** Check for overdue tasks, update status
- **Daily 8 AM:** Generate daily digest notification (leads in pipeline, follow-ups due, payments pending)
- **Daily:** Check for invoices due tomorrow, generate recurring invoices
- **Weekly:** Generate weekly analytics summary email

---

## 8. Data Migration Plan

You have data in three places that need to come into SalesHub:

### 8.1 Google Sheets (VSL_Leads.xlsx)

**Leads sheet (3,252 records):**
Map: Timestamp → created_at, Name → first_name (split on space for last_name), Phone → phone, Email → email, CallBooked → if 'yes' then set stage to '121 Booked', Source → source, UTM fields → direct map. All imported as type 'prospect' in the VSL funnel.

**Final Leads sheet (1,240 records):**
Map: First/Last name, Email, Phone → contact fields. Experience, Challenge, Salary, etc. → contact_form_responses table. Status → parse into structured stage + notes (e.g., 'Rejected - Bad quality lead' → stage: 'Lost', note: 'Bad quality lead - not looking for mentorship'). Attending → booking status.

**Deduplication:** Match on email (primary) or phone (secondary). Final Leads data takes priority for enrichment.

### 8.2 Brevo (2,000+ contacts)

Export as CSV from Brevo. Import into contacts table. Deduplicate against existing GSheet data. Any Brevo-only contacts get added. Tag all Brevo imports with 'source:brevo-import' for tracking.

### 8.3 Migration Script

Almas will build a one-time Node.js migration script that: (1) Reads the Excel + CSV files, (2) Normalizes phone numbers (ensure +91 prefix, remove spaces), (3) Deduplicates by email then phone, (4) Creates contacts with all available data, (5) Creates form_responses where qualifying data exists, (6) Generates an import report: X contacts created, Y duplicates merged, Z errors.

---

## 9. Phased Build Plan

Each phase is independently useful. Don't proceed to the next phase until the current one is working well in production.

| Phase | Modules | What You Can Do After | Est. Timeline |
|-------|---------|----------------------|---------------|
| **1** | Prospects, Funnels, Dashboard (basic), Settings (basic), Data Migration | See all leads in one place, track pipeline, assign leads, schedule follow-ups. Stop using GSheets. | 3–4 weeks |
| **2** | WhatsApp, Email, Calendar & Booking | Send WhatsApp + email from SalesHub, drip sequences, booking page live. Cancel AiSensy, Pabbly, Brevo, Calendly. | 4–5 weeks |
| **3** | Customers, Invoices | Convert prospects to customers, generate GST invoices, collect payments via Cashfree/Stripe. Stop manual invoicing. | 3–4 weeks |
| **4** | Finance, Analytics, full Dashboard | Complete P&L, expense tracking, ROI analysis, comprehensive morning dashboard. | 4–5 weeks |

### Phase 1 Detailed Breakdown

Since this is what Almas builds first, here's the detailed task list:

**Week 1: Project Setup + Database**
- Initialize Next.js project with TypeScript, Tailwind, shadcn/ui
- Set up Supabase project, create all database tables (full schema, including empty tables for future phases)
- Set up Supabase Auth (email/password login for Murad + Almas)
- Deploy to Vercel, configure app.xperiencewave.com subdomain
- Build app layout: sidebar navigation (all modules listed, some greyed out), top bar with search + notifications + quick actions

**Week 2: Funnels + Prospects Core**
- Funnels module: Create/edit funnels and stages. Pre-seed VSL and Webinar funnels.
- Prospects list view: Sortable, filterable table with pagination
- Prospects Kanban view: Drag-and-drop between stages
- Contact detail page: Overview tab with all info, Notes tab
- Quick add: Manual prospect creation form

**Week 3: Automation + Migration**
- Lead capture webhook: POST /api/webhooks/lead-capture
- Update landing page to POST to this webhook (replace Brevo/Pabbly connection)
- Tasks system: Create follow-up tasks, mark complete, overdue detection
- Data migration: Import GSheets + Brevo data via migration script
- Basic dashboard: Today's new leads, follow-ups due, pipeline summary

**Week 4: Polish + Go Live**
- Testing: Verify lead capture, pipeline flows, data accuracy
- Mobile responsiveness: Ensure sidebar collapses, tables scroll, Kanban works on tablet
- Notifications: In-app notification bell for new leads and overdue tasks
- Daily email digest (basic): Summary of yesterday's activity, today's tasks
- Go live: Switch landing page webhook from Brevo to SalesHub. Celebrate.

---

## 10. Cost Analysis

### Monthly Costs: Before vs. After (per phase)

| Tool/Service | Current | After Ph 1 | After Ph 2 | After Ph 3+ |
|-------------|---------|-----------|-----------|-------------|
| Google Workspace | ₹4,000 | ₹4,000 | ₹4,000 | ₹4,000 |
| AiSensy | ₹2,000 | ₹2,000 | ₹0 | ₹0 |
| Pabbly | ₹833 | ₹0 | ₹0 | ₹0 |
| Brevo | ₹0 (limited) | ₹0 | ₹0 | ₹0 |
| Calendly | ₹2,000 | ₹2,000 | ₹0 | ₹0 |
| Accounting person | ₹1,000 | ₹1,000 | ₹1,000 | ₹0 |
| WhatsApp API (direct) | — | — | ~₹800 | ~₹800 |
| Resend (email) | — | — | ~₹1,700 | ~₹1,700 |
| Hosting (Vercel + Supabase) | — | ₹0 (free tier) | ~₹3,600 | ~₹3,600 |
| **TOTAL (excl. Meta ads)** | **₹~10,000** | **₹~9,000** | **₹~8,100** | **₹~6,100** |

**Net monthly savings after all phases: ~₹3,900/month (₹46,800/year)**

Plus: elimination of 15–20 hours/week of manual work, zero missed follow-ups, and complete audit trail of every lead interaction. The real ROI is operational, not just financial.

---

## 11. Key Decisions & Trade-offs

### Decision 1: Build custom vs. use existing CRM (HubSpot, Zoho)

**Decision: Build custom.**

Why: Off-the-shelf CRMs charge ₹10–30k/month for the features you need (WhatsApp API, Indian payment gateways, GST invoicing). They're also rigid — your VSL-specific pipeline, Calendly-style booking with custom forms, and Indian accounting needs would require expensive plugins or workarounds. Custom gives you full control at lower cost.

**Trade-off:** Higher upfront time investment. Almas needs 3–4 months of focused building.

### Decision 2: Supabase vs. Firebase vs. raw PostgreSQL

**Decision: Supabase.**

Why: PostgreSQL (relational, ideal for CRM data with many relationships), built-in auth, realtime subscriptions (for live notifications), generous free tier, excellent Next.js integration. Firebase's NoSQL would make pipeline queries painful. Raw Postgres would need more DevOps.

### Decision 3: Resend vs. AWS SES vs. keep Brevo

**Decision: Resend.**

Why: Better developer experience than SES, built-in analytics (opens/clicks without building your own tracking pixel), React email templates, generous free tier. Brevo's 200/day limit is a dealbreaker at 2,000+ contacts.

### Decision 4: Direct WhatsApp Cloud API vs. middleware (Twilio, Gupshup)

**Decision: Direct Cloud API.**

Why: You already have access, your number is registered, templates are approved. No middleman markup. Gupshup/Twilio add ₹0.10–0.30 per message on top of Meta's cost. Direct API is the cheapest path.

**Trade-off:** Slightly more development work for webhook handling and message queuing. Worth it for the cost savings.

### Decision 5: Separate Customers vs. Prospects views

**Decision: Separate navigation items, same underlying contacts table.**

Why: The workflow, information, and actions for a customer (renewal tracking, program enrollment, payment history) are fundamentally different from a prospect (pipeline stage, qualifying data, follow-up urgency). Same database table with a 'type' field, but different UI views. This is cleaner than just a filter.

---

## 12. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| WhatsApp API number ownership | If AiSensy somehow controls the number, migration fails | Verify: Go to Meta Business Manager → WhatsApp Manager → Phone Numbers. If you see the number, you own it. (Screenshot confirms this ✓) |
| Landing page webhook change | Leads stop flowing during transition | Run BOTH systems in parallel for 1 week: keep Brevo webhook AND add SalesHub webhook. Verify counts match. Then remove Brevo. |
| Data loss during migration | Missing contacts or corrupted data | Export everything BEFORE starting. Run migration in staging first. Verify counts: 3,252 + 1,240 leads + Brevo contacts = expected total (minus duplicates). |
| Scope creep | Phase 1 takes 3 months instead of 3–4 weeks | Strictly follow phase plan. If a feature isn't in the current phase, it goes on a backlog. Ship Phase 1 before starting Phase 2. |
| Email deliverability | Emails from new domain land in spam | Set up SPF, DKIM, DMARC records correctly. Start with low volume. Warm up sending reputation over 2–3 weeks. |
| Supabase free tier limits | Database pauses after inactivity or hits storage limit | Free tier allows 500MB and no pause for active projects. At ~5,000 contacts with full history, you'll use ~50–100MB. Upgrade to Pro (₹2,100/mo) when you hit Phase 2. |
| Third salesperson onboarding | New person can't use the system | Design Phase 1 with multi-user in mind (assigned_to on contacts, user_id on activities). Adding a user = creating a Supabase Auth account. |

---

## Next Step

Almas starts Phase 1, Week 1: Initialize the project, set up Supabase, deploy the shell app to app.xperiencewave.com. She should open a new Claude conversation for coding assistance, referencing this architecture document for context.

For each module, the recommended workflow is:

1. Read the relevant section of this document
2. Ask Claude to help scaffold the database tables and API routes
3. Build the UI components with Claude's guidance
4. Test with real data (import a small batch of leads first)
5. Deploy and verify in production
6. Move to the next module

---

*— End of Document —*
