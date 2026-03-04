# SalesHub — Phase 2 Setup & Build Guide

> **Modules:** WhatsApp, Email, Calendar & Booking
> **Prerequisites:** Phase 1 fully deployed and working (Prospects, Funnels, Dashboard, Tasks)
> **Goal:** Send WhatsApp + email from SalesHub, build drip sequences, replace Calendly. Cancel AiSensy, Pabbly, Brevo, Calendly.
> **Estimated timeline:** 4–5 weeks
> **Monthly savings after Phase 2:** ~₹4,900/month (AiSensy ₹2K + Pabbly ₹833 + Calendly ₹2K)

---

## Pre-Phase 2 Checklist

Before writing any code, complete these setup tasks:

### 1. Upgrade Supabase to Pro

Your free tier is fine for Phase 1, but Phase 2 adds significant data (message logs, email events, booking records). Upgrade now.

```
Supabase Dashboard → Project Settings → Billing → Upgrade to Pro ($25/month)
```

This gives you: 8GB database, 250GB egress, 100K monthly active users, daily backups.

### 2. Set Up Resend Account

```
1. Go to https://resend.com → Create account
2. Add your sending domain:
   - Resend Dashboard → Domains → Add Domain
   - Enter: xperiencewave.com
   - Resend will give you 3 DNS records to add:
     - SPF record (TXT)
     - DKIM record (TXT)  
     - DMARC record (TXT — optional but recommended)
3. Add these DNS records in Vercel:
   - Vercel Dashboard → your project → Settings → Domains
   - Or wherever xperiencewave.com DNS is managed
4. Wait for verification (usually 5-30 minutes)
5. Copy your API key from Resend Dashboard → API Keys
6. Start on Free tier (3K emails/month, 100/day limit)
   Upgrade to Pro ($20/month) when you're ready to go live with campaigns
```

**Important:** Email deliverability takes time. After DNS setup, send yourself 10-20 test emails over a few days before sending to prospects. This "warms up" your domain reputation.

### 3. Set Up WhatsApp Cloud API

You already have the Meta Business Manager + WhatsApp number. Now connect it directly (replacing AiSensy).

```
1. Go to Meta Business Manager → Business Settings
2. Under WhatsApp → WhatsApp Accounts → your account
3. Create a System User:
   - Business Settings → Users → System Users → Add
   - Name: "SalesHub"
   - Role: Admin
   - Generate token with permissions:
     - whatsapp_business_messaging
     - whatsapp_business_management
   - Copy the permanent token
4. Note your Phone Number ID:
   - WhatsApp Manager → Phone Numbers → click your number
   - The ID is in the URL or the overview panel
5. Set up webhook:
   - WhatsApp Manager → Configuration → Webhook
   - Callback URL: https://app.xperiencewave.com/api/webhooks/whatsapp
   - Verify token: generate a random string and save it
   - Subscribe to: messages, message_status (delivered, read)
```

**Critical:** Do NOT disconnect from AiSensy yet. Run both systems in parallel for 1-2 weeks to verify SalesHub sends correctly.

### 4. Set Up Google Calendar API

```
1. Go to Google Cloud Console (console.cloud.google.com)
2. Create a new project: "SalesHub"
3. Enable the Google Calendar API:
   - APIs & Services → Library → search "Google Calendar API" → Enable
4. Create OAuth 2.0 credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth Client ID
   - Application type: Web application
   - Name: "SalesHub Calendar"
   - Authorized redirect URI: https://app.xperiencewave.com/api/auth/google/callback
   - (Also add http://localhost:3000/api/auth/google/callback for dev)
5. Copy: Client ID and Client Secret
6. Configure consent screen:
   - APIs & Services → OAuth consent screen
   - User type: Internal (if using Workspace) or External
   - App name: "SalesHub by Xperience Wave"
   - Scopes: calendar.events, calendar.readonly
```

### 5. Update Environment Variables

Add to `.env.local` and Vercel:

```env
# Resend
RESEND_API_KEY=re_xxxxxxxxxxxx

# WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_permanent_system_user_token
WHATSAPP_VERIFY_TOKEN=your_random_verify_string
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id

# Google Calendar
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://app.xperiencewave.com/api/auth/google/callback
```

```bash
# Push to Vercel
vercel env add RESEND_API_KEY
vercel env add WHATSAPP_PHONE_NUMBER_ID
vercel env add WHATSAPP_ACCESS_TOKEN
vercel env add WHATSAPP_VERIFY_TOKEN
vercel env add WHATSAPP_BUSINESS_ACCOUNT_ID
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add GOOGLE_REDIRECT_URI
```

---

## Step 1: Install Phase 2 Dependencies

```bash
cd saleshub

# Email sending
npm install resend

# Rich text / block editor for email composer
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image
npm install @tiptap/extension-link @tiptap/extension-placeholder
npm install @tiptap/extension-text-align @tiptap/extension-color
npm install @tiptap/extension-highlight @tiptap/extension-underline

# Alternatively, for the Notion-style block editor:
npm install @blocknote/core @blocknote/react @blocknote/mantine

# React Flow (for visual drip sequence builder)
npm install @xyflow/react

# Google APIs
npm install googleapis

# Background job processing
npm install inngest

# Date picker for booking pages
npm install react-day-picker

# Email templating (for building email templates server-side)
npm install @react-email/components react-email
```

---

## Step 2: New Folder Structure (Phase 2 Additions)

The folder structure from Phase 1 already has these directories created. Now we populate them:

```
src/
├── app/
│   ├── (app)/
│   │   ├── whatsapp/                      # ← BUILD THESE
│   │   │   ├── page.tsx                   # Campaign list
│   │   │   ├── campaigns/
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx           # Create campaign (one-time or drip)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx           # View/edit campaign + analytics
│   │   │   └── templates/
│   │   │       └── page.tsx               # WhatsApp template management
│   │   │
│   │   ├── email/                         # ← BUILD THESE
│   │   │   ├── page.tsx                   # Campaign list
│   │   │   ├── campaigns/
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx           # Create campaign
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx           # View/edit campaign + analytics
│   │   │   └── templates/
│   │   │       └── page.tsx               # Email template management
│   │   │
│   │   ├── calendar/                      # ← BUILD THESE
│   │   │   ├── page.tsx                   # Calendar overview / events
│   │   │   └── booking-pages/
│   │   │       ├── page.tsx               # Manage booking pages
│   │   │       └── [id]/
│   │   │           └── page.tsx           # Edit booking page settings
│   │   │
│   │   └── settings/
│   │       └── integrations/
│   │           └── page.tsx               # ← UPDATE: Google Calendar OAuth connect
│   │
│   ├── book/                              # ← BUILD THIS (PUBLIC, no auth)
│   │   └── [slug]/
│   │       └── page.tsx                   # Public booking page (Calendly replacement)
│   │
│   └── api/
│       ├── webhooks/
│       │   ├── whatsapp/
│       │   │   └── route.ts               # ← BUILD: incoming messages + status updates
│       │   └── email/
│       │       └── route.ts               # ← BUILD: Resend open/click/bounce events
│       │
│       ├── auth/
│       │   └── google/
│       │       └── callback/
│       │           └── route.ts           # ← BUILD: Google OAuth callback
│       │
│       ├── whatsapp/
│       │   ├── send/
│       │   │   └── route.ts              # Send template message
│       │   └── templates/
│       │       └── route.ts              # List/manage approved templates
│       │
│       ├── email/
│       │   └── send/
│       │       └── route.ts              # Send email via Resend
│       │
│       ├── campaigns/
│       │   ├── email/
│       │   │   └── route.ts              # CRUD email campaigns
│       │   └── whatsapp/
│       │       └── route.ts              # CRUD WA campaigns
│       │
│       ├── bookings/
│       │   ├── route.ts                  # Create/list bookings
│       │   ├── [id]/
│       │   │   └── route.ts              # Get/update booking
│       │   └── availability/
│       │       └── route.ts              # Check available slots
│       │
│       ├── booking-pages/
│       │   ├── route.ts                  # CRUD booking pages
│       │   └── [id]/
│       │       └── route.ts
│       │
│       └── cron/
│           └── drip-processor/
│               └── route.ts              # ← BUILD: Process drip queues
│
├── components/
│   ├── communication/                     # ← BUILD THESE
│   │   ├── wa-template-picker.tsx         # Select from approved WA templates
│   │   ├── wa-campaign-builder.tsx        # Audience + template + schedule
│   │   ├── wa-drip-builder.tsx            # Visual flowchart editor for WA drips
│   │   ├── email-campaign-builder.tsx     # Audience + content + schedule
│   │   ├── email-drip-builder.tsx         # Visual flowchart editor for email drips
│   │   ├── email-block-editor.tsx         # Notion-style block editor
│   │   ├── drip-flow-canvas.tsx           # Shared: React Flow canvas component
│   │   ├── drip-node-step.tsx             # Flow node: send message step
│   │   ├── drip-node-delay.tsx            # Flow node: wait/delay
│   │   ├── drip-node-condition.tsx        # Flow node: if/else branch
│   │   ├── drip-node-stop.tsx             # Flow node: stop condition
│   │   ├── campaign-list-table.tsx        # Reusable campaign list table
│   │   ├── campaign-analytics.tsx         # Opens, clicks, delivery stats
│   │   └── message-history.tsx            # Contact-level message thread view
│   │
│   ├── calendar/                          # ← BUILD THESE
│   │   ├── booking-page-builder.tsx       # Form: title, duration, fields, availability
│   │   ├── availability-picker.tsx        # Visual week/day availability grid
│   │   ├── time-slot-grid.tsx             # Public: available time slots display
│   │   ├── booking-form.tsx               # Public: the 10-question qualifying form
│   │   ├── booking-confirmation.tsx       # Public: success screen after booking
│   │   └── event-card.tsx                 # Calendar event display card
│   │
│   └── prospects/
│       └── prospect-detail.tsx            # ← UPDATE: add Communication tab content
│
├── lib/
│   ├── whatsapp/                          # ← BUILD THESE
│   │   ├── client.ts                      # Meta Cloud API wrapper
│   │   ├── templates.ts                   # Template message helpers + variable insertion
│   │   └── webhook-handler.ts             # Parse incoming webhook events
│   │
│   ├── email/                             # ← BUILD THESE
│   │   ├── client.ts                      # Resend API wrapper
│   │   ├── webhook-handler.ts             # Parse Resend webhook events
│   │   └── templates/                     # React Email templates
│   │       ├── base-layout.tsx            # Shared email layout (header, footer, XW branding)
│   │       ├── welcome.tsx                # Lead welcome email
│   │       ├── booking-confirmation.tsx   # Booking confirmed email
│   │       ├── booking-reminder.tsx       # 24h before meeting reminder
│   │       └── drip-wrapper.tsx           # Wrapper for drip sequence emails
│   │
│   ├── google/                            # ← BUILD THESE
│   │   ├── calendar.ts                    # Google Calendar API wrapper
│   │   ├── auth.ts                        # OAuth2 token management
│   │   └── meet.ts                        # Google Meet link generation
│   │
│   └── inngest/
│       ├── client.ts                      # Inngest client setup
│       ├── drip-processor.ts              # Process drip sequence queue
│       ├── send-wa-message.ts             # Background: send WA with rate limiting
│       ├── send-email.ts                  # Background: send email via Resend
│       └── booking-reminders.ts           # 24h reminder cron
│
├── hooks/
│   ├── use-campaigns.ts                   # Campaign CRUD operations
│   ├── use-whatsapp.ts                    # WA sending + template management
│   ├── use-email.ts                       # Email sending
│   ├── use-bookings.ts                    # Booking operations
│   └── use-google-calendar.ts             # Calendar connection status
│
└── types/
    ├── campaigns.ts                       # Campaign, step, send types
    ├── whatsapp.ts                        # WA-specific types
    ├── email.ts                           # Email-specific types
    └── bookings.ts                        # Booking + booking page types
```

---

## Step 3: Database Additions

Phase 1 already created the tables (email_campaigns, email_steps, email_sends, wa_campaigns, wa_steps, wa_sends, booking_pages, bookings). But you may need to add:

Run in Supabase SQL Editor:

```sql
-- Drip enrollment tracking (which contacts are actively in a drip)
CREATE TABLE drip_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('email', 'whatsapp')),
  current_step_order INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'stopped')),
  next_send_at TIMESTAMP WITH TIME ZONE,
  stopped_reason TEXT, -- e.g., 'booking_created', 'manual', 'unsubscribed'
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_drip_enrollments_next_send ON drip_enrollments(next_send_at) 
  WHERE status = 'active';
CREATE INDEX idx_drip_enrollments_contact ON drip_enrollments(contact_id);

-- Store Google Calendar OAuth tokens per team member
ALTER TABLE team_members 
  ADD COLUMN IF NOT EXISTS google_access_token TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT false;

-- Store visual flow data for drip sequences
ALTER TABLE email_campaigns 
  ADD COLUMN IF NOT EXISTS flow_data JSONB; -- React Flow serialized nodes + edges

-- Same for WA campaigns (you'll need to create this table if not exists)
-- wa_campaigns should mirror email_campaigns structure
-- Add flow_data column there too

-- Unsubscribe tracking
CREATE TABLE unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX idx_unsubscribes_contact_channel ON unsubscribes(contact_id, channel);
```

---

## Step 4: API Wrapper Files (Build First)

These are the foundation — everything else depends on them.

### WhatsApp Client (`src/lib/whatsapp/client.ts`)

Ask Claude to build this with the following spec:

```
WhatsApp Cloud API wrapper using fetch.
Base URL: https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}

Functions needed:
- sendTemplate(to: string, templateName: string, params: string[])
  → sends an approved template message
  → returns message ID for tracking
  
- sendTextMessage(to: string, body: string)
  → sends a free-form text (only works within 24h conversation window)

- getTemplates()
  → GET /message_templates from the WABA
  → returns list of approved templates with their parameters

- markAsRead(messageId: string)
  → marks incoming message as read

All functions should:
  - Format phone numbers (ensure +91 prefix, no spaces)
  - Return typed responses
  - Handle rate limits (80 msgs/sec standard tier)
  - Log errors but don't throw (return success/failure status)

Reference: ARCHITECTURE.md Section 7.2
```

### Resend Client (`src/lib/email/client.ts`)

```
Resend API wrapper.

Functions needed:
- sendEmail({ to, subject, html, from?, replyTo? })
  → sends via Resend API
  → from defaults to "Xperience Wave <team@xperiencewave.com>"
  → returns message ID

- sendBatchEmails(emails: Array<{ to, subject, html }>)
  → sends up to 100 emails in one API call (Resend batch endpoint)
  → returns array of message IDs

Reference: ARCHITECTURE.md Section 7.3
```

### Google Calendar (`src/lib/google/calendar.ts`)

```
Google Calendar API wrapper using googleapis npm package.

Functions needed:
- getAuthUrl(teamMemberId: string) → returns OAuth URL for consent
- handleCallback(code: string, teamMemberId: string) → exchanges code for tokens, saves to team_members
- refreshToken(teamMemberId: string) → refreshes expired access token
- getFreeBusy(teamMemberId: string, timeMin: Date, timeMax: Date) → returns busy slots
- createEvent(teamMemberId: string, { summary, start, end, attendeeEmail, description })
  → creates event with Google Meet link auto-generated
  → returns event ID + Meet link
- deleteEvent(teamMemberId: string, eventId: string)
- listEvents(teamMemberId: string, timeMin: Date, timeMax: Date)

Reference: ARCHITECTURE.md Section 7.4
```

---

## Phase 2 Build Order

Follow this exact sequence. Each step builds on the previous one.

### Week 1: API Foundations + WhatsApp Core

```
1.  WhatsApp client (src/lib/whatsapp/client.ts)
    → API wrapper for Meta Cloud API
    → Test: send a template message to your own number
    → Reference: ARCHITECTURE.md Section 7.2

2.  WhatsApp webhook (src/app/api/webhooks/whatsapp/route.ts)
    → Verify webhook (GET request from Meta for verification)
    → Handle incoming: message status updates (sent, delivered, read)
    → Handle incoming: messages received (for future conversation view)
    → Log all events as activities on the contact
    → Test: send a message via step 1, verify webhook receives status
    → Reference: ARCHITECTURE.md Section 7.2

3.  WhatsApp template management page (src/app/(app)/whatsapp/templates/page.tsx)
    → Fetch approved templates from Meta API
    → Display as cards: template name, status, language, preview
    → "Use in Campaign" button on each template
    → Reference: ARCHITECTURE.md Section 6.2 (WhatsApp → Template management)
    → Design: DESIGN_SYSTEM.md Section 4.5 (reuse data table pattern)

4.  Quick WhatsApp send from Contact Detail
    → Update Contact Detail page: "WhatsApp" quick action now works
    → Click → opens modal: pick template, preview with contact's name filled in, send
    → On send: call WhatsApp client, log activity, show toast
    → This is the fastest win — you can immediately start using it

5.  WhatsApp campaign builder (one-time send)
    → New page: src/app/(app)/whatsapp/campaigns/new/page.tsx
    → Step 1: Select audience (filter by funnel, stage, tag, source, etc.)
      Audience count shown live: "This will send to 142 contacts"
    → Step 2: Select template + fill in dynamic parameters
    → Step 3: Schedule (send now or pick date/time)
    → On send: create campaign record, enqueue messages via Inngest
    → Reference: ARCHITECTURE.md Section 6.2
    → Design: PAGE_LAYOUTS_PHASE2.md (when available)
```

### Week 2: WhatsApp Drips + Email Foundation

```
6.  Drip sequence flow builder (WhatsApp)
    → New page: builds on the campaign builder
    → Type = 'drip': shows the React Flow canvas
    → Nodes: Start trigger, Send template, Wait/delay, Condition, Stop
    → Edges: connect nodes to define the flow
    → Save: serialize React Flow state to flow_data JSONB column
    → Reference: Your visual flowchart decision
    → This is the most complex component — budget 3-4 days

7.  Drip processor (background job)
    → Inngest function: runs every 15 minutes (not hourly — faster for welcome messages)
    → Checks drip_enrollments where next_send_at <= now AND status = 'active'
    → For each: send the message, advance to next step, calculate next_send_at
    → Stop conditions: check if contact has booked (query bookings table)
    → Reference: ARCHITECTURE.md Section 7.6

8.  Resend client (src/lib/email/client.ts)
    → API wrapper for Resend
    → Test: send yourself a test email from team@xperiencewave.com
    → Verify: check email lands in inbox (not spam)

9.  Email webhook (src/app/api/webhooks/email/route.ts)
    → Handle: delivered, opened, clicked, bounced, complained
    → Update email_sends status accordingly
    → Log activity on contact (email_opened, etc.)
    → Reference: ARCHITECTURE.md Section 7.3

10. Email template system (src/lib/email/templates/)
    → Build base layout with React Email: XW header, footer, unsubscribe link
    → Build: welcome.tsx, booking-confirmation.tsx, booking-reminder.tsx
    → These are server-side rendered — not the block editor (that's for campaigns)
    → Reference: ARCHITECTURE.md Section 6.2 (Email → Templates)
```

### Week 3: Email Campaigns + Block Editor + Calendar

```
11. Email block editor component (src/components/communication/email-block-editor.tsx)
    → Notion-style block editor using BlockNote or TipTap
    → Blocks: text paragraph, heading, image, button (CTA), divider, columns
    → Variable insertion: type {{ to see dropdown of contact fields
      {{first_name}}, {{last_name}}, {{company}}, {{booking_link}}
    → Preview mode: toggle between edit and rendered preview
    → Output: serialized to HTML for sending via Resend
    → This is a complex component — budget 2-3 days

12. Email campaign builder
    → New page: src/app/(app)/email/campaigns/new/page.tsx
    → Type selector: One-time send, Drip sequence, Newsletter
    → One-time send:
      Step 1: Audience filter (same pattern as WhatsApp campaigns)
      Step 2: Compose email using block editor
      Step 3: Subject line + preview text + sender name
      Step 4: Schedule or send now
    → Reference: ARCHITECTURE.md Section 6.2

13. Email drip sequence builder
    → Same React Flow canvas pattern as WhatsApp drips
    → Nodes: Start, Send email (opens block editor), Wait, Condition, Stop
    → Conditions specific to email: opened, clicked link, bounced
    → Save flow + all email content to database

14. Google Calendar OAuth setup
    → Settings → Integrations: "Connect Google Calendar" button
    → Click → redirects to Google OAuth consent
    → Callback saves tokens to team_members table
    → Show connection status: green dot + "Connected as murad@..."
    → "Disconnect" button to revoke access
    → Reference: ARCHITECTURE.md Section 7.4

15. Google Calendar wrapper
    → Build src/lib/google/calendar.ts
    → Test: fetch Murad's free/busy for today, create a test event
    → Verify: event appears in Google Calendar with Meet link
```

### Week 4: Booking Pages + Integration + Polish

```
16. Booking page builder (admin side)
    → New page: src/app/(app)/calendar/booking-pages/[id]/page.tsx
    → Form fields:
      - Title: "Design Career Strategy Call"
      - Slug: auto-generated from title, editable
      - Duration: 45 minutes (dropdown: 15, 30, 45, 60, 90)
      - Description: rich text
      - Assigned team members: multi-select (Murad, Almas)
      - Assignment mode: round-robin or specific person
    → Availability rules:
      - Visual week grid: toggle days on/off
      - Per-day time range: 10:00 AM – 6:00 PM
      - Buffer between meetings: 15 min
      - Max meetings per day: 5
      - Blocked specific dates: date picker
    → Form builder:
      - List of qualifying questions (replicating your 10 Calendly questions)
      - Each question: label, type (text, select, textarea, radio), required toggle
      - Drag to reorder
    → Confirmation settings:
      - Send confirmation email: toggle
      - Send WhatsApp confirmation: toggle
    → Preview link: opens public booking page in new tab
    → Reference: ARCHITECTURE.md Section 6.3

17. Public booking page (Calendly replacement)
    → Route: src/app/book/[slug]/page.tsx (NO auth required)
    → This is prospect-facing — must be polished
    → Flow: [to be finalized — see your pending booking page decisions]
    → Calendar component: shows available dates (checking Google Calendar)
    → Time slots: based on availability rules minus busy times
    → Form: renders the qualifying questions from booking page config
    → On submit:
      a. Create booking in database
      b. Create/find contact (by email/phone match)
      c. Move contact to "121 Booked" stage
      d. Create Google Calendar event with Meet link
      e. Send confirmation email + WhatsApp (if enabled)
      f. Log activities on the contact
    → Embed support: generate iframe code for ld.xperiencewave.com
    → Reference: ARCHITECTURE.md Section 6.3

18. Availability engine (src/app/api/bookings/availability/route.ts)
    → Input: booking_page_id, date range
    → Logic:
      a. Get availability rules from booking page
      b. Get assigned team members
      c. For each member: fetch Google Calendar free/busy
      d. Generate available time slots
      e. Round-robin: show union of all members' availability
         Specific: show only that person's availability
    → Output: array of { date, time, assignedTo } slots

19. Communication tab on Contact Detail
    → Update the Contact Detail page
    → Communication tab now shows real data:
      All WhatsApp messages (sent + received) + all emails
      Interleaved chronologically
      WhatsApp: show delivery status (✓ sent, ✓✓ delivered, ✓✓ blue = read)
      Email: show open/click status
      Each message card: timestamp, content preview, status
    → Reference: PAGE_LAYOUTS.md Section 2 (Tab: Timeline already covers this)

20. Campaign list pages + analytics
    → WhatsApp campaigns list: src/app/(app)/whatsapp/page.tsx
    → Email campaigns list: src/app/(app)/email/page.tsx
    → Both show: campaign name, type (one-time/drip), status, date,
      delivery stats (sent, delivered, opened, clicked)
    → Click → campaign detail page with full analytics
    → Reference: DESIGN_SYSTEM.md Section 4.5 (data table pattern)

21. Update sidebar: enable Phase 2 modules
    → In src/lib/constants.ts: change CURRENT_PHASE to 2
    → WhatsApp, Email, Calendar nav items become active (no longer "Coming Soon")

22. Booking reminders cron
    → Inngest function: runs daily at 8 AM
    → Find bookings happening tomorrow
    → Send reminder email + WhatsApp to each prospect
    → Reference: ARCHITECTURE.md Section 7.6

23. Update lead capture webhook
    → src/app/api/webhooks/lead-capture/route.ts (already exists from Phase 1)
    → ADD: auto-enroll new leads into active drip sequences
    → When a lead comes in: check for active drip campaigns targeting new leads
    → Create drip_enrollment record with next_send_at = now (immediate first step)

24. Testing + parallel run
    → Run SalesHub WhatsApp + existing AiSensy in parallel for 1 week
    → Verify: message delivery rates match
    → Verify: webhook status updates are received correctly
    → Verify: booking page works end-to-end (book → calendar event → confirmations)
    → Run npm run build — fix any TypeScript errors
    → Mobile responsive check: booking page must work perfectly on phone
    → Load test: send campaign to 50 contacts, verify all delivered

25. Go live: cancel old tools
    → Disconnect landing page from Brevo (already done in Phase 1 for capture, 
      now also for email sending)
    → Cancel AiSensy subscription
    → Cancel Pabbly subscription  
    → Cancel Calendly subscription
    → Update ld.xperiencewave.com: replace Calendly embed with SalesHub booking iframe
    → Celebrate: you just saved ₹4,900/month 🎉
```

---

## Week-by-Week Summary

| Week | Focus | Deliverable |
|------|-------|-------------|
| **1** | WhatsApp API + quick send + one-time campaigns | Send WA templates from SalesHub, campaign builder working |
| **2** | WA drip builder + Email foundation + webhooks | Visual drip sequences live, email sending verified |
| **3** | Email campaigns + block editor + Google Calendar | Full email campaign builder, calendar OAuth connected |
| **4** | Booking pages + availability engine + polish + go live | Public booking page replaces Calendly, all integrations tested |

---

## How to Use Claude for Phase 2 Building

When building each component, share these files for context:

```
For API/backend work:
  → ARCHITECTURE.md (Section 5: Database Schema, Section 7: API Integrations)
  → This file (PHASE2_SETUP.md) for the specific task details

For UI/frontend work:
  → DESIGN_SYSTEM.md (colors, components, patterns)
  → PAGE_LAYOUTS.md or LAYOUTS_PHASE2.md (page-specific layouts)
  → ARCHITECTURE.md (for what data each page shows)
```

### Example Prompts

**WhatsApp client:**
> "I'm building SalesHub Phase 2. Reference: docs/ARCHITECTURE.md Section 7.2 and docs/PHASE2_SETUP.md Step 4. Build the WhatsApp Cloud API wrapper at src/lib/whatsapp/client.ts. Functions: sendTemplate, sendTextMessage, getTemplates, markAsRead. Use fetch, handle rate limits, type all responses. Phone number ID and token are in env vars."

**Drip sequence builder:**
> "I'm building the visual drip sequence builder for WhatsApp campaigns. Reference: docs/PHASE2_SETUP.md step 6. Using @xyflow/react (React Flow). Build src/components/communication/wa-drip-builder.tsx. Custom nodes: StartNode, SendTemplateNode (shows template picker), DelayNode (hours/days input), ConditionNode (if booking created), StopNode. Serialize flow state to JSONB. Follow docs/DESIGN_SYSTEM.md for Horizon color palette."

**Public booking page:**
> "I'm building the public booking page at src/app/book/[slug]/page.tsx. No auth required. Reference: docs/ARCHITECTURE.md Section 6.3 and docs/PHASE2_SETUP.md step 17. It needs to: fetch available slots from /api/bookings/availability, show a date picker + time slots, then a qualifying form with questions defined in the booking page config. On submit: create booking, create/find contact, create Google Calendar event with Meet link, send confirmations. Must work perfectly on mobile."

---

## Key Technical Notes

### Rate Limiting for WhatsApp Campaigns

When sending to 500+ contacts, you cannot blast all at once. Meta limits standard tier to 80 messages/second.

```
Strategy: use Inngest with staggered sends
- Enqueue each message as a separate Inngest event
- Inngest handles retries + rate limiting
- Each event: send one message, wait 50ms, next
- For 500 contacts: takes ~30 seconds
- For 2000 contacts: takes ~2 minutes
```

### Email Warm-Up Schedule

Don't send 2000 emails on day one. Follow this ramp:

```
Day 1-3:   50 emails/day (to your most engaged contacts)
Day 4-7:   200 emails/day
Day 8-14:  500 emails/day
Day 15+:   Full volume
```

### Drip Flow Data Format

The visual flow builder serializes to this format (stored in flow_data JSONB):

```json
{
  "nodes": [
    { "id": "start", "type": "trigger", "data": { "event": "lead_created" }, "position": { "x": 0, "y": 0 } },
    { "id": "step1", "type": "send", "data": { "templateName": "xw_vsl_start", "params": ["{{first_name}}"] }, "position": { "x": 0, "y": 150 } },
    { "id": "delay1", "type": "delay", "data": { "hours": 24 }, "position": { "x": 0, "y": 300 } },
    { "id": "cond1", "type": "condition", "data": { "check": "booking_created" }, "position": { "x": 0, "y": 450 } },
    { "id": "stop", "type": "stop", "data": { "reason": "booked" }, "position": { "x": 200, "y": 600 } },
    { "id": "step2", "type": "send", "data": { "templateName": "xw_book_24" }, "position": { "x": -200, "y": 600 } }
  ],
  "edges": [
    { "source": "start", "target": "step1" },
    { "source": "step1", "target": "delay1" },
    { "source": "delay1", "target": "cond1" },
    { "source": "cond1", "target": "stop", "sourceHandle": "yes" },
    { "source": "cond1", "target": "step2", "sourceHandle": "no" }
  ]
}
```

The drip processor reads this graph and walks through it for each enrolled contact.

---

## Important Reminders

- **Keep AiSensy running** until WhatsApp sending is verified (1-2 weeks)
- **Keep Calendly running** until booking page is verified end-to-end
- **Email warm-up is not optional** — skip it and your emails go to spam
- **Test webhooks using ngrok** during local development (Meta/Resend need a public URL)
- **The booking page is public** — it needs to be fast, mobile-optimized, and beautiful
- **Run `npm run build` daily** — catch TypeScript errors early, not at deploy time
- **Commit after each step works** — `git commit -m "Phase 2 Step 6: WA drip builder"`
- **Create a `phase-2` branch** — don't push broken Phase 2 code to main

---

*Reference documents:*
- *ARCHITECTURE.md — Database schema (Section 5), Module specs (Section 6.2, 6.3), API integrations (Section 7)*
- *DESIGN_SYSTEM.md — Visual language, component specs*
- *PAGE_LAYOUTS.md — Dashboard and Contact Detail layouts*
- *LAYOUTS_PHASE2.md — [To be created: WhatsApp, Email, Calendar, Booking page layouts]*

*Last updated: February 26, 2026*
