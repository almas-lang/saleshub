# SalesHub — Project Setup & Structure Guide

> **For:** Almas (Developer) & Murad (Product Owner)
> **Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Supabase
> **Hosting:** Vercel (app.xperiencewave.com)

---

## Prerequisites

Before starting, make sure you have these installed:

```bash
# Check Node.js (need v18.17+)
node -v

# Check npm
npm -v

# Check git
git -v
```

If Node.js is not installed, download from https://nodejs.org (LTS version).

---

## Step 1: Create the Project

Open VS Code terminal and run:

```bash
# Create Next.js project with TypeScript + Tailwind + App Router
npx create-next-app@latest saleshub --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Enter the project
cd saleshub

# Initialize git
git init
git add .
git commit -m "Initial Next.js setup"
```

---

## Step 2: Install Core Dependencies

```bash
# shadcn/ui (component library — saves weeks of UI work)
npx shadcn@latest init

# When prompted:
# - Style: Default
# - Base color: Neutral
# - CSS variables: Yes

# Install shadcn components we'll use heavily
npx shadcn@latest add button card input label select textarea
npx shadcn@latest add table tabs dialog sheet dropdown-menu
npx shadcn@latest add badge avatar separator command
npx shadcn@latest add toast popover calendar checkbox
npx shadcn@latest add form alert tooltip skeleton

# Supabase client
npm install @supabase/supabase-js @supabase/ssr

# Date handling
npm install date-fns

# Icons
npm install lucide-react

# Drag and drop (for Kanban board)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Form handling + validation
npm install react-hook-form @hookform/resolvers zod

# Email templating (for building email templates)
npm install @react-email/components react-email

# PDF generation (for invoices — Phase 3, but install now)
npm install @react-pdf/renderer
```

---

## Step 3: Set Up Supabase

### 3a. Create Supabase Project

1. Go to https://supabase.com → Start your project
2. Create a new project:
   - **Organization:** Xperience Wave
   - **Project name:** saleshub
   - **Database password:** (save this somewhere safe!)
   - **Region:** South Asia (Mumbai) — ap-south-1
3. Wait for project to be created (~2 minutes)
4. Go to **Settings → API** and copy:
   - Project URL (e.g., `https://xxxx.supabase.co`)
   - `anon` public key
   - `service_role` secret key (NEVER expose this in frontend code)

### 3b. Create Environment File

Create `.env.local` in your project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# These will be added in later phases:
# RESEND_API_KEY=
# WHATSAPP_PHONE_NUMBER_ID=
# WHATSAPP_ACCESS_TOKEN=
# WHATSAPP_VERIFY_TOKEN=
# CASHFREE_APP_ID=
# CASHFREE_SECRET_KEY=
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# INNGEST_EVENT_KEY=
# INNGEST_SIGNING_KEY=
```

### 3c. Add `.env.local` to `.gitignore`

Verify `.env.local` is already in `.gitignore` (it should be by default with Next.js).

---

## Step 4: Project Structure

This is the full project structure. **Create all folders now** — even empty ones for later phases. This ensures consistent architecture as you build.

```
saleshub/
├── .env.local                    # Environment variables (NEVER commit)
├── .gitignore
├── next.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
│
├── public/
│   ├── logo.svg                  # XW logo
│   └── favicon.ico
│
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── layout.tsx            # Root layout (sidebar + topbar)
│   │   ├── page.tsx              # Redirect to /dashboard
│   │   ├── globals.css           # Global styles + Tailwind
│   │   │
│   │   ├── (auth)/               # Auth pages (no sidebar)
│   │   │   ├── layout.tsx        # Auth layout (centered, no sidebar)
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── forgot-password/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (app)/                # App pages (with sidebar)
│   │   │   ├── layout.tsx        # App layout with sidebar + topbar
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx      # Phase 1: Basic summary cards
│   │   │   │
│   │   │   ├── prospects/
│   │   │   │   ├── page.tsx      # Phase 1: List + Kanban toggle
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx  # Phase 1: Contact detail page
│   │   │   │   └── import/
│   │   │   │       └── page.tsx  # Phase 1: CSV/XLSX import
│   │   │   │
│   │   │   ├── customers/
│   │   │   │   ├── page.tsx      # Phase 3: Customer list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx  # Phase 3: Customer detail
│   │   │   │
│   │   │   ├── funnels/
│   │   │   │   ├── page.tsx      # Phase 1: Funnel list + create
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx  # Phase 1: Edit funnel stages
│   │   │   │
│   │   │   ├── whatsapp/
│   │   │   │   ├── page.tsx      # Phase 2: Campaigns list
│   │   │   │   ├── campaigns/
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── templates/
│   │   │   │       └── page.tsx  # Phase 2: Template management
│   │   │   │
│   │   │   ├── email/
│   │   │   │   ├── page.tsx      # Phase 2: Email campaigns
│   │   │   │   ├── campaigns/
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── templates/
│   │   │   │       └── page.tsx  # Phase 2: Email templates
│   │   │   │
│   │   │   ├── calendar/
│   │   │   │   ├── page.tsx      # Phase 2: Calendar overview
│   │   │   │   └── booking-pages/
│   │   │   │       ├── page.tsx  # Phase 2: Manage booking pages
│   │   │   │       └── [id]/
│   │   │   │           └── page.tsx
│   │   │   │
│   │   │   ├── invoices/
│   │   │   │   ├── page.tsx      # Phase 3: Invoice list
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx  # Phase 3: Create invoice
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx  # Phase 3: View/edit invoice
│   │   │   │
│   │   │   ├── finance/
│   │   │   │   ├── page.tsx      # Phase 4: P&L overview
│   │   │   │   ├── expenses/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── reports/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx      # Phase 4: Analytics dashboard
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── page.tsx      # Phase 1: Basic settings
│   │   │       ├── profile/
│   │   │       │   └── page.tsx
│   │   │       ├── team/
│   │   │       │   └── page.tsx
│   │   │       ├── integrations/
│   │   │       │   └── page.tsx
│   │   │       └── notifications/
│   │   │           └── page.tsx
│   │   │
│   │   ├── book/                 # PUBLIC booking pages (no auth)
│   │   │   └── [slug]/
│   │   │       └── page.tsx      # Phase 2: Public booking page
│   │   │
│   │   └── api/                  # API routes
│   │       ├── webhooks/
│   │       │   ├── lead-capture/
│   │       │   │   └── route.ts  # Phase 1: Landing page webhook
│   │       │   ├── whatsapp/
│   │       │   │   └── route.ts  # Phase 2: WA incoming messages
│   │       │   ├── email/
│   │       │   │   └── route.ts  # Phase 2: Resend webhooks
│   │       │   ├── cashfree/
│   │       │   │   └── route.ts  # Phase 3: Payment confirmation
│   │       │   └── stripe/
│   │       │       └── route.ts  # Phase 3: Stripe webhooks
│   │       │
│   │       ├── contacts/
│   │       │   ├── route.ts      # GET (list), POST (create)
│   │       │   ├── [id]/
│   │       │   │   └── route.ts  # GET, PATCH, DELETE
│   │       │   ├── import/
│   │       │   │   └── route.ts  # POST: bulk import
│   │       │   └── search/
│   │       │       └── route.ts  # GET: global search
│   │       │
│   │       ├── funnels/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       └── route.ts
│   │       │
│   │       ├── tasks/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       └── route.ts
│   │       │
│   │       ├── activities/
│   │       │   └── route.ts
│   │       │
│   │       ├── bookings/
│   │       │   ├── route.ts      # Phase 2
│   │       │   └── [id]/
│   │       │       └── route.ts
│   │       │
│   │       ├── campaigns/
│   │       │   ├── email/
│   │       │   │   └── route.ts  # Phase 2
│   │       │   └── whatsapp/
│   │       │       └── route.ts  # Phase 2
│   │       │
│   │       ├── invoices/
│   │       │   ├── route.ts      # Phase 3
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── pdf/
│   │       │           └── route.ts  # Generate PDF
│   │       │
│   │       └── cron/
│   │           ├── daily-digest/
│   │           │   └── route.ts  # Phase 1: Daily summary email
│   │           ├── drip-processor/
│   │           │   └── route.ts  # Phase 2: Process drip queues
│   │           └── overdue-tasks/
│   │               └── route.ts  # Phase 1: Mark overdue tasks
│   │
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # shadcn/ui components (auto-generated)
│   │   │
│   │   ├── layout/
│   │   │   ├── sidebar.tsx       # Phase 1: Main navigation sidebar
│   │   │   ├── topbar.tsx        # Phase 1: Search + notifications + quick actions
│   │   │   ├── sidebar-item.tsx  # Individual nav item (with "coming soon" support)
│   │   │   └── mobile-nav.tsx    # Phase 1: Mobile hamburger menu
│   │   │
│   │   ├── prospects/
│   │   │   ├── prospect-table.tsx      # Phase 1: Data table with filters
│   │   │   ├── prospect-kanban.tsx     # Phase 1: Kanban board
│   │   │   ├── kanban-card.tsx         # Phase 1: Individual Kanban card
│   │   │   ├── prospect-detail.tsx     # Phase 1: Contact detail view
│   │   │   ├── prospect-form.tsx       # Phase 1: Add/edit prospect
│   │   │   ├── prospect-filters.tsx    # Phase 1: Filter sidebar
│   │   │   └── prospect-timeline.tsx   # Phase 1: Activity timeline
│   │   │
│   │   ├── funnels/
│   │   │   ├── funnel-builder.tsx      # Phase 1: Create/edit funnel stages
│   │   │   └── stage-card.tsx          # Phase 1: Draggable stage card
│   │   │
│   │   ├── tasks/
│   │   │   ├── task-list.tsx           # Phase 1: Task list with filters
│   │   │   └── task-form.tsx           # Phase 1: Create/edit task
│   │   │
│   │   ├── dashboard/
│   │   │   ├── stats-cards.tsx         # Phase 1: Summary stat cards
│   │   │   ├── pipeline-chart.tsx      # Phase 1: Funnel visualization
│   │   │   └── tasks-due-today.tsx     # Phase 1: Today's tasks widget
│   │   │
│   │   ├── communication/             # Phase 2
│   │   │   ├── campaign-builder.tsx
│   │   │   ├── drip-sequence-editor.tsx
│   │   │   ├── email-composer.tsx
│   │   │   ├── wa-template-picker.tsx
│   │   │   └── message-history.tsx
│   │   │
│   │   ├── calendar/                   # Phase 2
│   │   │   ├── booking-page-builder.tsx
│   │   │   ├── availability-picker.tsx
│   │   │   └── event-card.tsx
│   │   │
│   │   ├── invoices/                   # Phase 3
│   │   │   ├── invoice-builder.tsx
│   │   │   ├── invoice-preview.tsx
│   │   │   └── payment-status.tsx
│   │   │
│   │   └── shared/
│   │       ├── data-table.tsx          # Phase 1: Reusable sortable/filterable table
│   │       ├── page-header.tsx         # Phase 1: Page title + actions
│   │       ├── empty-state.tsx         # Phase 1: "No data yet" with CTA
│   │       ├── coming-soon.tsx         # Phase 1: Placeholder for future modules
│   │       ├── confirm-dialog.tsx      # Phase 1: Confirmation modal
│   │       ├── search-command.tsx      # Phase 1: Global search (Cmd+K)
│   │       └── notification-bell.tsx   # Phase 1: Notification dropdown
│   │
│   ├── lib/                      # Utilities and helpers
│   │   ├── supabase/
│   │   │   ├── client.ts         # Browser Supabase client
│   │   │   ├── server.ts         # Server-side Supabase client
│   │   │   ├── middleware.ts     # Auth middleware helper
│   │   │   └── types.ts          # Generated database types
│   │   │
│   │   ├── utils.ts              # General utilities (cn(), formatDate, etc.)
│   │   ├── constants.ts          # App-wide constants (funnel stages, etc.)
│   │   ├── validations.ts        # Zod schemas for form validation
│   │   │
│   │   ├── whatsapp/             # Phase 2
│   │   │   ├── client.ts         # Meta Cloud API wrapper
│   │   │   └── templates.ts      # Template message helpers
│   │   │
│   │   ├── email/                # Phase 2
│   │   │   ├── client.ts         # Resend API wrapper
│   │   │   └── templates/        # React email templates
│   │   │       ├── welcome.tsx
│   │   │       ├── booking-confirmation.tsx
│   │   │       └── invoice.tsx
│   │   │
│   │   ├── payments/             # Phase 3
│   │   │   ├── cashfree.ts
│   │   │   └── stripe.ts
│   │   │
│   │   └── google/               # Phase 2
│   │       └── calendar.ts       # Google Calendar API wrapper
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-contacts.ts       # Phase 1: Contact CRUD operations
│   │   ├── use-funnels.ts        # Phase 1: Funnel operations
│   │   ├── use-tasks.ts          # Phase 1: Task operations
│   │   ├── use-activities.ts     # Phase 1: Activity log
│   │   └── use-debounce.ts       # Phase 1: Search debouncing
│   │
│   ├── types/                    # TypeScript type definitions
│   │   ├── database.ts           # Supabase generated types
│   │   ├── contacts.ts           # Contact-related types
│   │   ├── funnels.ts            # Funnel-related types
│   │   ├── campaigns.ts          # Campaign types (Phase 2)
│   │   └── invoices.ts           # Invoice types (Phase 3)
│   │
│   └── middleware.ts             # Next.js middleware (auth protection)
│
├── supabase/
│   ├── migrations/               # Database migrations (SQL files)
│   │   ├── 001_initial_schema.sql     # All tables — run this first
│   │   ├── 002_seed_funnels.sql       # Default funnels + stages
│   │   ├── 003_seed_team.sql          # Murad + Almas accounts
│   │   └── 004_rls_policies.sql       # Row-level security
│   └── config.toml
│
└── scripts/
    ├── migrate-leads.ts          # One-time: Import VSL_Leads.xlsx
    ├── migrate-brevo.ts          # One-time: Import Brevo CSV export
    └── seed-dev.ts               # Create test data for development
```

---

## Step 5: Create the Folder Structure

Run this in your terminal from the project root (`saleshub/`):

```bash
# App routes - Auth
mkdir -p src/app/\(auth\)/login
mkdir -p src/app/\(auth\)/forgot-password

# App routes - Main app
mkdir -p src/app/\(app\)/dashboard
mkdir -p src/app/\(app\)/prospects/\[id\]
mkdir -p src/app/\(app\)/prospects/import
mkdir -p src/app/\(app\)/customers/\[id\]
mkdir -p src/app/\(app\)/funnels/\[id\]
mkdir -p src/app/\(app\)/whatsapp/campaigns/new
mkdir -p src/app/\(app\)/whatsapp/campaigns/\[id\]
mkdir -p src/app/\(app\)/whatsapp/templates
mkdir -p src/app/\(app\)/email/campaigns/new
mkdir -p src/app/\(app\)/email/campaigns/\[id\]
mkdir -p src/app/\(app\)/email/templates
mkdir -p src/app/\(app\)/calendar/booking-pages/\[id\]
mkdir -p src/app/\(app\)/invoices/new
mkdir -p src/app/\(app\)/invoices/\[id\]
mkdir -p src/app/\(app\)/finance/expenses
mkdir -p src/app/\(app\)/finance/reports
mkdir -p src/app/\(app\)/analytics
mkdir -p src/app/\(app\)/settings/profile
mkdir -p src/app/\(app\)/settings/team
mkdir -p src/app/\(app\)/settings/integrations
mkdir -p src/app/\(app\)/settings/notifications

# Public booking pages (no auth)
mkdir -p src/app/book/\[slug\]

# API routes
mkdir -p src/app/api/webhooks/lead-capture
mkdir -p src/app/api/webhooks/whatsapp
mkdir -p src/app/api/webhooks/email
mkdir -p src/app/api/webhooks/cashfree
mkdir -p src/app/api/webhooks/stripe
mkdir -p src/app/api/contacts/\[id\]
mkdir -p src/app/api/contacts/import
mkdir -p src/app/api/contacts/search
mkdir -p src/app/api/funnels/\[id\]
mkdir -p src/app/api/tasks/\[id\]
mkdir -p src/app/api/activities
mkdir -p src/app/api/bookings/\[id\]
mkdir -p src/app/api/campaigns/email
mkdir -p src/app/api/campaigns/whatsapp
mkdir -p src/app/api/invoices/\[id\]/pdf
mkdir -p src/app/api/cron/daily-digest
mkdir -p src/app/api/cron/drip-processor
mkdir -p src/app/api/cron/overdue-tasks

# Components
mkdir -p src/components/layout
mkdir -p src/components/prospects
mkdir -p src/components/funnels
mkdir -p src/components/tasks
mkdir -p src/components/dashboard
mkdir -p src/components/communication
mkdir -p src/components/calendar
mkdir -p src/components/invoices
mkdir -p src/components/shared

# Lib
mkdir -p src/lib/supabase
mkdir -p src/lib/whatsapp
mkdir -p src/lib/email/templates
mkdir -p src/lib/payments
mkdir -p src/lib/google

# Hooks, Types
mkdir -p src/hooks
mkdir -p src/types

# Supabase
mkdir -p supabase/migrations

# Scripts
mkdir -p scripts
```

---

## Step 6: Create Core Files (Phase 1)

The following files are needed to get the app running. Ask Claude to help you write the contents of each file — share this document for context.

### 6a. Supabase Client Setup

**`src/lib/supabase/client.ts`** — Browser-side Supabase client:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**`src/lib/supabase/server.ts`** — Server-side Supabase client:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  );
}
```

### 6b. Auth Middleware

**`src/middleware.ts`**:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't need auth
  const publicPaths = ["/login", "/forgot-password", "/book", "/api/webhooks"];
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### 6c. Utility Functions

**`src/lib/utils.ts`**:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return format(new Date(date), "dd MMM yyyy");
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), "dd MMM yyyy, hh:mm a");
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatPhone(phone: string) {
  // Ensure +91 prefix for Indian numbers
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    return `+${cleaned}`;
  }
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  return `+${cleaned}`;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
```

### 6d. Constants

**`src/lib/constants.ts`**:

```typescript
// Navigation items — all modules listed from day one
export const NAV_ITEMS = [
  // Group: Overview
  {
    group: "Overview",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", phase: 1 },
    ],
  },
  // Group: Sales
  {
    group: "Sales",
    items: [
      { name: "Prospects", href: "/prospects", icon: "Users", phase: 1 },
      { name: "Customers", href: "/customers", icon: "UserCheck", phase: 3 },
      { name: "Funnels", href: "/funnels", icon: "GitBranch", phase: 1 },
    ],
  },
  // Group: Communicate
  {
    group: "Communicate",
    items: [
      { name: "WhatsApp", href: "/whatsapp", icon: "MessageCircle", phase: 2 },
      { name: "Email", href: "/email", icon: "Mail", phase: 2 },
      { name: "Calendar", href: "/calendar", icon: "Calendar", phase: 2 },
    ],
  },
  // Group: Money
  {
    group: "Money",
    items: [
      { name: "Invoices", href: "/invoices", icon: "Receipt", phase: 3 },
      { name: "Finance", href: "/finance", icon: "IndianRupee", phase: 4 },
    ],
  },
  // Group: Insights
  {
    group: "Insights",
    items: [
      { name: "Analytics", href: "/analytics", icon: "BarChart3", phase: 4 },
    ],
  },
] as const;

// Current build phase — increment this as you complete phases
export const CURRENT_PHASE = 1;

// Default funnel stages for VSL flow
export const DEFAULT_VSL_STAGES = [
  { name: "New Lead", order: 1, color: "#94A3B8" },
  { name: "Contacted", order: 2, color: "#60A5FA" },
  { name: "121 Booked", order: 3, color: "#A78BFA" },
  { name: "121 Done", order: 4, color: "#F59E0B" },
  { name: "Proposal Sent", order: 5, color: "#FB923C" },
  { name: "Converted", order: 6, color: "#34D399", isTerminal: true },
  { name: "Lost", order: 7, color: "#EF4444", isTerminal: true },
];

// Default funnel stages for Webinar flow
export const DEFAULT_WEBINAR_STAGES = [
  { name: "Registered", order: 1, color: "#94A3B8" },
  { name: "Attended", order: 2, color: "#60A5FA" },
  { name: "Interested", order: 3, color: "#A78BFA" },
  { name: "Converted", order: 4, color: "#34D399", isTerminal: true },
  { name: "Lost", order: 5, color: "#EF4444", isTerminal: true },
];
```

---

## Step 7: Database Migration (Run in Supabase)

Go to Supabase Dashboard → SQL Editor → New Query, and run the SQL from the `001_initial_schema.sql` migration file.

> **Ask Claude:** "Help me write the full database schema SQL for SalesHub based on the Architecture Guide. Include all tables for all phases (contacts, contact_form_responses, funnels, funnel_stages, activities, tasks, email_campaigns, email_steps, email_sends, wa_campaigns, wa_steps, wa_sends, booking_pages, bookings, invoices, transactions, team_members, notifications, email_templates, wa_templates, companies, customer_programs, files). Use UUIDs, timestamps, enums, and proper foreign keys."

---

## Step 8: Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (follow prompts — link to existing Vercel account)
vercel

# Set environment variables on Vercel
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Deploy to production
vercel --prod
```

Then in Vercel dashboard:
1. Go to your project → Settings → Domains
2. Add `app.xperiencewave.com`
3. It will show you a CNAME record to add
4. Go to your DNS settings (also in Vercel, since you manage xperiencewave.com there)
5. Add the CNAME record: `app` → `cname.vercel-dns.com`

---

## Step 9: Development Workflow

```bash
# Start development server
npm run dev

# Open in browser
# http://localhost:3000

# Before each commit
git add .
git commit -m "descriptive message"
git push origin main  # Auto-deploys to Vercel
```

---

## Phase 1 Build Order (What to build first)

Follow this exact order. Each step builds on the previous one:

1. **Login page** — Simple email/password login with Supabase Auth
2. **App layout** — Sidebar + topbar (all nav items, greyed-out for future phases)
3. **Coming Soon page** — Placeholder for Phase 2+ modules
4. **Funnels page** — Create VSL and Webinar funnels with stages
5. **Prospects list view** — Data table with sorting, filtering, pagination
6. **Prospect detail page** — Full contact profile with tabs
7. **Prospects Kanban view** — Drag-and-drop pipeline board
8. **Quick add prospect** — Manual entry form
9. **Lead capture webhook** — API endpoint for landing page
10. **Tasks system** — Create, list, complete follow-up tasks
11. **Dashboard** — Summary cards + today's tasks + pipeline overview
12. **Data import** — CSV/XLSX upload for existing leads
13. **Global search** — Cmd+K search across contacts
14. **Notifications** — In-app notification bell
15. **Daily digest** — Cron job for daily email summary

---

## How to Use Claude for Building

When building each component, open a Claude conversation and share:

1. This setup guide (for project structure context)
2. The Architecture Guide document (for database schema and feature specs)
3. The specific task you're working on

Example prompt:
> "I'm building SalesHub. Here's the architecture doc [attach]. I've completed the project setup and database. Now I need to build the Sidebar component (src/components/layout/sidebar.tsx). It should show all navigation groups from constants.ts, grey out items where phase > CURRENT_PHASE, highlight the active route, and collapse on mobile. Using shadcn/ui + Tailwind + Lucide icons."

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (localhost:3000) |
| `npm run build` | Production build (catch errors) |
| `vercel` | Deploy preview |
| `vercel --prod` | Deploy to production |
| `npx shadcn@latest add [component]` | Add a new shadcn component |
| `npx supabase gen types typescript` | Regenerate DB types after schema changes |

---

## Important Notes

- **Never commit `.env.local`** — it contains your API keys
- **Run `npm run build` before deploying** — catches TypeScript errors that dev mode misses
- **Create a branch for each phase** — `git checkout -b phase-2` before starting Phase 2
- **Test webhook endpoints using Postman** or curl before connecting the landing page
- **Keep Brevo/AiSensy/Calendly running** until the SalesHub replacement is verified working

---

*Last updated: February 25, 2026*
*Reference: SalesHub_Architecture_Guide.docx*
