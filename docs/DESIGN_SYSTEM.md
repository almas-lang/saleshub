# SalesHub Design System

> **Palette:** Horizon
> **Aesthetic:** Clean & minimal, Apple-like restraint, warm and refined
> **Principle:** Every pixel earns its place. If it doesn't serve the user, remove it.
> **For:** Almas (developer) — feed this file to Claude Code alongside ARCHITECTURE.md

---

## 1. Design Tokens (CSS Variables)

Add these to `src/app/globals.css` AFTER the Tailwind imports. The entire app themes through these variables — changing a value here updates everything.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ─── Background ─── */
    --background: 0 0% 99%;           /* #FCFCFC - warm off-white */
    --background-subtle: 225 14% 96%; /* #F3F4F7 - hover states, alt rows */
    --background-muted: 225 12% 91%;  /* #E5E7ED - borders, dividers */

    /* ─── Foreground (Text) ─── */
    --foreground: 228 20% 10%;        /* #1A1D23 - primary text */
    --foreground-secondary: 224 10% 40%; /* #5C6370 - secondary text */
    --foreground-muted: 220 8% 56%;   /* #858B98 - placeholders, disabled */
    --foreground-subtle: 220 8% 72%;  /* #AFB3BC - timestamps, metadata */

    /* ─── Primary (Horizon Warm Blue) ─── */
    --primary: 231 92% 63%;           /* #4A6CF7 - warm blue leaning indigo */
    --primary-hover: 232 80% 55%;     /* #3B5AE0 */
    --primary-subtle: 231 100% 97%;   /* #EEF2FF - selected rows, tag bg */
    --primary-foreground: 0 0% 100%;  /* White on primary */

    /* ─── Semantic Colors ─── */
    --success: 157 55% 40%;           /* #2D9F6F */
    --success-subtle: 157 55% 96%;    /* #EEFBF5 */
    --warning: 40 88% 45%;            /* #E59A0B */
    --warning-subtle: 40 88% 96%;     /* #FFF9EB */
    --danger: 0 58% 52%;              /* #D94F4F */
    --danger-subtle: 0 58% 97%;       /* #FEF2F2 */
    --info: 200 65% 50%;              /* #2B9FCC */
    --info-subtle: 200 65% 96%;       /* #EFF9FD */

    /* ─── Sidebar ─── */
    --sidebar-bg: 222 47% 11%;        /* #0F172A */
    --sidebar-hover: 222 38% 16%;     /* #1E293B */
    --sidebar-active: 222 32% 22%;    /* #2A3650 */
    --sidebar-text: 215 20% 65%;      /* #94A3B8 */
    --sidebar-text-active: 0 0% 100%; /* #FFFFFF */
    --sidebar-border: 222 28% 18%;    /* Separator lines */
    --sidebar-group: 215 12% 45%;     /* Group labels */

    /* ─── Surfaces ─── */
    --card: 0 0% 100%;
    --card-border: 225 14% 91%;       /* #E5E8EF */
    --card-shadow: 0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03);
    --card-shadow-hover: 0 4px 12px 0 rgba(0,0,0,0.06), 0 2px 4px -1px rgba(0,0,0,0.04);
    --card-shadow-lifted: 0 8px 24px 0 rgba(0,0,0,0.08), 0 4px 8px -2px rgba(0,0,0,0.05);

    /* ─── Pipeline Stage Colors (muted, cohesive) ─── */
    --stage-new: #94A3B8;
    --stage-contacted: #6B8AED;
    --stage-booked: #8B7CF7;
    --stage-done: #E5A340;
    --stage-proposal: #E08A4A;
    --stage-converted: #34B77A;
    --stage-lost: #D96060;

    /* ─── Radius ─── */
    --radius-sm: 6px;
    --radius: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
    --radius-full: 9999px;

    /* ─── Transitions ─── */
    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --duration-fast: 100ms;
    --duration-base: 180ms;
    --duration-slow: 280ms;
  }

  .dark {
    --background: 225 45% 7%;          /* #0B0F1A */
    --background-subtle: 225 38% 11%;  /* #141925 */
    --background-muted: 225 28% 17%;   /* #212736 */

    --foreground: 220 15% 90%;
    --foreground-secondary: 220 10% 65%;
    --foreground-muted: 220 8% 42%;
    --foreground-subtle: 220 8% 32%;

    --primary: 231 90% 68%;            /* Lighter in dark mode */
    --primary-hover: 231 90% 74%;
    --primary-subtle: 231 90% 13%;

    --success: 157 55% 50%;
    --success-subtle: 157 55% 11%;
    --warning: 40 88% 55%;
    --warning-subtle: 40 88% 11%;
    --danger: 0 58% 60%;
    --danger-subtle: 0 58% 11%;

    --sidebar-bg: 225 50% 5%;
    --sidebar-hover: 225 40% 10%;
    --sidebar-active: 225 35% 14%;

    --card: 225 38% 11%;
    --card-border: 225 28% 19%;
    --card-shadow: 0 1px 3px 0 rgba(0,0,0,0.3);
    --card-shadow-hover: 0 4px 12px 0 rgba(0,0,0,0.4);
  }
}

/* ─── Global Styles ─── */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

/* Scrollbar styling (subtle) */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: hsl(var(--background-muted)); border-radius: 99px; }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--foreground-subtle)); }

/* Focus rings (accessible, on-brand) */
*:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Selection color */
::selection {
  background: hsl(var(--primary) / 0.15);
  color: hsl(var(--foreground));
}
```

---

## 2. Typography

### Font Stack

In `src/app/layout.tsx`:

```typescript
import { DM_Sans, JetBrains_Mono } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

// Apply to <html> or <body>:
// className={`${dmSans.variable} ${jetbrainsMono.variable} font-sans antialiased`}
```

In `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    fontFamily: {
      sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      mono: ["var(--font-mono)", "monospace"],
    },
  },
},
```

### Type Scale

DM Sans for everything. Warm, geometric, reads well at data-dense sizes.

| Element | Tailwind Class | Weight | Extra | Usage |
|---------|---------------|--------|-------|-------|
| Page title | `text-xl` (20px) | `font-semibold` | `tracking-tight` | "Prospects", "Dashboard" |
| Section header | `text-sm` (14px) | `font-semibold` | — | "Today's Focus", "Pipeline" |
| Card title / Name | `text-sm` (14px) | `font-medium` | — | Contact names in lists, card titles |
| Body text | `text-sm` (14px) | `font-normal` | — | Descriptions, notes, paragraphs |
| Small / Meta | `text-xs` (12px) | `font-normal` | — | Timestamps, counts, metadata |
| Tiny labels | `text-[11px]` | `font-medium` | `uppercase tracking-wider` | Column headers, group labels, badges |
| Stat numbers | `text-2xl` (24px) | `font-bold` | `font-mono tracking-tight` | Dashboard stat cards |
| Data values | `text-sm` (14px) | `font-normal` | `font-mono` | Phone, invoice #, ₹ amounts |

### Typography Rules

1. **Nothing larger than text-xl (20px)** inside the app. This isn't a marketing site.
2. **Phone numbers and currency always use `font-mono`** — digits align, feel precise.
3. **Timestamps: `text-xs text-foreground-subtle`** — they're reference, not primary info.
4. **Contact names are the loudest element** — always `font-medium` minimum.
5. **No ALL CAPS** except for tiny labels (`text-[11px] uppercase tracking-wider`).
6. **No underlined links** — use `text-primary hover:text-primary-hover` color change instead.
7. **Line height: keep Tailwind defaults** — `leading-normal` for body, `leading-tight` for headings.

---

## 3. Spacing & Layout

### Page Structure

```
┌──────────────────────────────────────────────────────────────┐
│ Sidebar (240px)       │  Main Area (flex-1)                  │
│ fixed, full height    │  ┌─────────────────────────────────┐ │
│                       │  │ Topbar (56px) — fixed            │ │
│                       │  │ Search    Notifications    + New │ │
│                       │  └─────────────────────────────────┘ │
│                       │                                      │
│                       │  ┌─────────────────────────────────┐ │
│                       │  │ Page Content                     │ │
│                       │  │ max-w-screen-xl mx-auto          │ │
│                       │  │ px-6 py-6                        │ │
│                       │  │                                   │ │
│                       │  └─────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Key Dimensions

| Element | Value | Tailwind |
|---------|-------|----------|
| Sidebar width | 240px | `w-60` |
| Sidebar collapsed | 64px | `w-16` |
| Topbar height | 56px | `h-14` |
| Content max-width | 1280px | `max-w-screen-xl` |
| Content padding | 24px | `px-6 py-6` |
| Card padding | 16px or 20px | `p-4` or `p-5` |
| Card gap | 16px | `gap-4` |
| Table row height | 48px | `h-12` |
| Kanban column width | 280px | `w-[280px]` |
| Modal widths | 420px / 560px / 720px | `max-w-md` / `max-w-lg` / `max-w-2xl` |

### Spacing Conventions

- **Page title → content:** `mb-6`
- **Between page sections:** `mt-8`
- **Between cards in grid:** `gap-4`
- **Between list items:** `space-y-2` or `space-y-1`
- **Inside cards:** `p-4` (compact) or `p-5` (spacious)
- **Button internal padding:** `px-4 py-2` (default), `px-3 py-1.5` (small)

---

## 4. Component Specifications

### 4.1 Sidebar

```
Structure:
├── Logo area (h-14, flex items-center, px-4)
│   └── XW icon + "SalesHub" text
├── Nav groups (flex-1, overflow-y-auto, py-2)
│   ├── Group label ("OVERVIEW", "SALES", etc.)
│   │   └── text-[11px] uppercase tracking-wider font-medium
│   │       color: var(--sidebar-group), px-4, pt-4 pb-1
│   └── Nav items
│       └── h-9 px-3 mx-2 rounded-md flex items-center gap-2.5
│           icon: 16px (w-4 h-4)
│           text: text-sm
│           Default: color var(--sidebar-text), bg transparent
│           Hover: bg var(--sidebar-hover), text brightens
│           Active: bg var(--sidebar-active), text white,
│                   left border 2px var(--primary)
│           "Coming Soon": text at 40% opacity, badge on right
│               badge: text-[9px] bg-white/5 text-sidebar-text
│                      px-1.5 py-0.5 rounded-full
└── User area (border-t border-sidebar-border, p-3)
    └── Avatar (32px, rounded-full, bg primary, initials white)
        + Name (text-sm white) + Role (text-xs sidebar-text)

Behavior:
- On tablet (< 1024px): collapse to 64px, show only icons
- On mobile (< 768px): hidden, triggered by hamburger in topbar
  slides in as overlay with backdrop blur
- Active item determined by current route (usePathname)
- Smooth transition on collapse: width 240px → 64px, 200ms ease
- Tooltip on icon-only mode showing the nav item name
```

### 4.2 Topbar

```
Structure:
├── Left: Breadcrumb or page context (optional)
├── Center: Search bar
│   └── w-full max-w-md h-9 rounded-lg
│       bg var(--background-subtle), border var(--card-border)
│       placeholder: "Search contacts, invoices..." text-sm
│       Right side: ⌘K badge (text-[10px], border, rounded-sm)
│       On click: opens Command Palette modal (see 4.8)
├── Right: Notification bell + Quick Add button
│   ├── Bell icon: relative, 20px
│   │   └── Red dot (6px) if unread notifications
│   │       position absolute, -top-0.5 -right-0.5
│   └── "+" button: 32px square, rounded-lg, bg primary
│         color white, hover bg primary-hover
│         Opens dropdown: Add Prospect, Send Message,
│                         Create Invoice, Book Meeting

Style:
- h-14, border-b border-card-border, bg card
- px-4 flex items-center gap-3
- Sticky top-0 z-30
```

### 4.3 Stat Cards (Dashboard)

```
Layout: grid grid-cols-4 gap-4 (2 cols on mobile)

Each card:
├── bg card, border card-border, rounded-xl (var(--radius-lg))
├── p-5
├── shadow: var(--card-shadow)
├── hover: var(--card-shadow-hover), transition 180ms
│
├── Label: text-[11px] uppercase tracking-wider font-medium
│          color foreground-muted
├── Value: text-2xl font-bold font-mono tracking-tight
│          color foreground (or var(--danger) if alert)
│          margin-top: mt-1
└── Subtext: text-xs color foreground-subtle
             margin-top: mt-0.5

Animation on load:
- Cards fade in with stagger (0ms, 50ms, 100ms, 150ms)
- Numbers count up from 0 over 400ms using ease-out
- Use CSS: @keyframes fadeInUp { from { opacity:0; transform:translateY(8px) } }

Special states:
- "Overdue" card: left border 3px var(--danger)
- Values that are zero: show in foreground-muted color, not bold
```

### 4.4 Kanban Board

```
Layout:
├── Header row: flex items-center justify-between mb-4
│   ├── Page title: text-xl font-semibold
│   ├── Funnel selector: Select dropdown (text-sm)
│   ├── View toggle: Kanban | List (pill toggle)
│   └── "+ Add Lead" button (primary)
│
├── Columns container: flex gap-4 overflow-x-auto pb-4
│   └── Each column:
│       ├── Header: sticky top-0 bg background
│       │   ├── Stage dot (8px, rounded-full, stage color)
│       │   ├── Stage name (text-[11px] uppercase tracking-wider font-semibold)
│       │   └── Count badge (text-[11px] text-foreground-muted)
│       ├── Cards container: flex flex-col gap-2 min-h-[200px]
│       │   padding: p-1 (provides drop zone spacing)
│       └── "+ Add" ghost button at bottom (text-xs, dashed border)

Each Kanban card:
├── w-[268px] (column is 280px with padding)
├── bg card, border card-border, rounded-lg (var(--radius))
├── p-3
├── border-left: 3px solid [stage color]
├── cursor: grab (cursor-grabbing when dragging)
│
├── Name: text-sm font-medium text-foreground (truncate if long)
├── Phone: text-xs font-mono text-foreground-muted
│          on click: copy to clipboard or open WhatsApp
├── Bottom row: flex items-center justify-between mt-2
│   ├── Time since last activity: text-[11px] text-foreground-subtle
│   │   "2 hours ago" (green) | "3 days ago" (red if > 2 days)
│   └── Assigned avatar: 20px rounded-full, initials

Drag behavior (@dnd-kit):
- On pick up: card scales to 1.02, shadow → card-shadow-lifted,
  opacity 0.9, rotate 1-2deg
- Drop zone: column bg changes to primary-subtle when hovering
- On drop: brief scale animation (1.02 → 1.0, 150ms ease-spring)
- Stage change triggers: activity log entry + optional toast

Urgency indicator:
- No contact in 0-2 days: border-left stays stage color
- No contact in 3-4 days: border-left becomes var(--warning)
- No contact in 5+ days: border-left becomes var(--danger),
  subtle pulse animation on the left border
```

### 4.5 Data Table (Prospects List View)

```
Structure:
├── Toolbar: flex items-center justify-between mb-4
│   ├── Left: Filter pills + search input
│   │   ├── Filter button: icon + "Filters" text-sm
│   │   │   Opens sheet/panel from right with filter options
│   │   └── Active filters shown as pills:
│   │       bg primary-subtle, text primary, text-xs
│   │       rounded-full, px-2.5 py-0.5, × to remove
│   └── Right: Column toggle, Export, "+ Add Lead"
│
├── Table: w-full
│   ├── Header row: bg background-subtle
│   │   └── Cells: text-[11px] uppercase tracking-wider
│   │              font-medium text-foreground-muted
│   │              h-10 px-4
│   │              Sortable columns: cursor-pointer,
│   │              hover text-foreground, ↑↓ indicator
│   │
│   ├── Body rows:
│   │   └── h-12 border-b border-card-border
│   │       hover: bg background-subtle (transition 100ms)
│   │       Cells: text-sm px-4
│   │       Name cell: font-medium, clickable (opens detail)
│   │       Phone cell: font-mono text-foreground-secondary
│   │       Stage cell: inline badge with dot + stage name
│   │           dot: 6px rounded-full [stage color]
│   │           text: text-xs font-medium
│   │       "Last Activity" cell: relative time, color-coded
│   │       Checkbox: first column, for bulk select
│   │
│   └── Empty state: centered in table body
│       illustration + "No prospects yet"
│       + "Add your first lead" CTA button

Pagination: flex items-center justify-between mt-4
├── "Showing 1-25 of 328 prospects" (text-sm text-foreground-muted)
└── Page buttons: gap-1, rounded-md, h-8 w-8
    Active page: bg primary text-white
    Inactive: bg transparent text-foreground-secondary hover:bg-background-subtle

Bulk actions bar (appears when rows selected):
├── Sticky bottom, bg card, border-t, shadow-lg
├── "12 selected" + [Assign] [Move Stage] [Tag] [Delete]
└── slide-up animation on appear
```

### 4.6 Contact Detail Page

```
Layout:
├── Back link: text-sm text-foreground-muted hover:text-foreground
│   "← Back to Prospects" — flex items-center gap-1
│
├── Header section: flex gap-6 items-start
│   ├── Left: Contact info card (flex-1)
│   │   ├── Avatar: 48px rounded-full bg primary
│   │   │          text-lg font-semibold text-white
│   │   │          initials centered
│   │   ├── Name: text-xl font-semibold mt-0 ml (inline with avatar)
│   │   ├── Meta row: flex items-center gap-4 mt-1
│   │   │   ├── Email: text-sm text-foreground-secondary
│   │   │   │         + copy icon (14px, opacity 0, appears on hover)
│   │   │   ├── Phone: text-sm font-mono text-foreground-secondary
│   │   │   │         + copy icon
│   │   │   └── LinkedIn: small icon link
│   │   ├── Tags row: flex gap-1.5 mt-3
│   │   │   ├── Type badge: "Prospect" or "Customer"
│   │   │   │   bg primary-subtle text-primary text-xs rounded-full px-2.5 py-0.5
│   │   │   ├── Funnel badge: "VSL Flow" — bg background-subtle text-foreground-secondary
│   │   │   ├── Stage badge: dot + stage name, colored by stage
│   │   │   └── Source: text-xs text-foreground-subtle
│   │   └── Assigned to: "Murad" with small avatar, text-xs
│   │
│   └── Right: Quick Actions panel (w-48, flex flex-col gap-2)
│       ├── Each action: flex items-center gap-2 h-9 px-3
│       │   rounded-md border border-card-border
│       │   text-sm text-foreground-secondary
│       │   hover: bg background-subtle, text-foreground
│       │   icon: 16px
│       ├── 📞 Call
│       ├── 💬 WhatsApp
│       ├── ✉️  Email
│       ├── 📅 Schedule
│       ├── 📝 Add Note
│       └── 🔔 Follow-up
│           This one: if no active follow-up, shows as normal
│           If follow-up exists: shows due date, colored by urgency
│
├── Tabs: border-b border-card-border, mt-6
│   ├── [Overview] [Timeline] [Communication] [Bookings] [Invoices] [Notes]
│   ├── Each tab: text-sm py-2.5 px-1
│   │   Inactive: text-foreground-muted, hover text-foreground
│   │   Active: text-foreground font-medium,
│   │          bottom border 2px primary (animated slide)
│   └── Tab content: mt-6

Tab: Overview
├── Two-column grid (lg:grid-cols-2 gap-6)
│   ├── Left: Qualifying Data card
│   │   ├── bg card, border, rounded-xl, p-5
│   │   ├── Title: "Qualifying Data" text-sm font-semibold mb-4
│   │   └── Field rows: flex justify-between py-2 border-b last:border-0
│   │       label: text-sm text-foreground-muted
│   │       value: text-sm text-foreground font-medium
│   │       Special values:
│   │         Financial readiness "Ready" → ✅ green
│   │         Financial readiness "Not ready" → ❌ red  
│   │         Urgency "Right now" → 🔥 with text-warning
│   │
│   └── Right: Quick Stats card
│       ├── Total interactions, Days in pipeline,
│       │   Emails opened/sent ratio, Last contact date

Tab: Timeline
├── Vertical timeline, left-aligned
│   ├── Each entry: flex gap-3
│   │   ├── Icon circle: 28px rounded-full, colored by type
│   │   │   stage_change: primary, email: info, wa: success,
│   │   │   call: warning, note: foreground-muted, payment: success
│   │   ├── Content:
│   │   │   ├── Title: text-sm font-medium
│   │   │   ├── Body: text-sm text-foreground-secondary (if exists)
│   │   │   └── Time: text-xs text-foreground-subtle
│   │   └── Connecting line: 1px bg-card-border from icon to next icon
│   └── "Load more" at bottom if paginated
```

### 4.7 Empty States

Every list, table, and page needs a designed empty state.

```
Structure:
├── Centered in the available space (flex items-center justify-center)
├── min-height: 300px (so it doesn't look squished)
│
├── Icon: 48px, text-foreground-subtle, opacity 40%
│   Use a relevant Lucide icon (Users for prospects, etc.)
├── Title: text-base font-medium text-foreground mt-4
│   "No prospects yet"
├── Description: text-sm text-foreground-muted mt-1 max-w-sm text-center
│   "When leads come in from your landing page or you add them manually, they'll appear here."
├── CTA button: mt-4, primary button
│   "Add your first prospect" / "Create a funnel" / etc.
│
└── OPTIONAL: secondary link below button
    "or import from CSV" — text-sm text-primary

Specific empty states:
- Prospects: "No prospects yet" + Add / Import
- Kanban column: just a subtle dashed border zone, no text
  (columns should never feel broken)
- Timeline: "No activity yet. Make the first move!"
- Tasks: "All caught up! No tasks due." (positive framing)
- Communication tab: "No messages yet with {name}"
```

### 4.8 Command Palette (Cmd+K)

```
Trigger: ⌘K / Ctrl+K, or click the search bar in topbar

Modal:
├── Backdrop: bg black/50, backdrop-blur-sm
├── Dialog: w-full max-w-lg, rounded-xl, bg card
│          shadow-card-shadow-lifted, border card-border
│          Centered vertically (slightly above center: top-[40%])
│
├── Search input: h-12 px-4 text-base border-b border-card-border
│   autofocus, placeholder "Type to search..."
│   No border/outline on focus (the modal IS the focus)
│
├── Results list: max-h-80 overflow-y-auto py-2
│   ├── Group headers: text-[11px] uppercase tracking-wider
│   │   font-medium text-foreground-muted px-4 py-2
│   │   "Contacts", "Actions", "Pages"
│   │
│   ├── Result items: h-10 px-4 flex items-center gap-3
│   │   rounded-md mx-2
│   │   Hover / keyboard-selected: bg background-subtle
│   │   Icon (16px) + Label (text-sm) + Subtitle (text-xs muted, right-aligned)
│   │
│   └── Actions section (always shown):
│       "Add Prospect", "Create Task", "New Invoice"
│       Each with keyboard shortcut hint on the right

Animation:
- Open: fade in backdrop (150ms), scale dialog from 0.98 → 1.0 (200ms ease-out)
- Close: reverse, 120ms
- Results: items appear with 30ms stagger
```

### 4.9 Toast Notifications

```
Position: bottom-right, 24px from edge

Toast:
├── max-w-sm, rounded-lg, bg card, border card-border
├── shadow-card-shadow-lifted
├── p-3, flex items-start gap-3
│
├── Icon: 18px rounded-full
│   Success: bg success-subtle, icon success
│   Error: bg danger-subtle, icon danger
│   Info: bg primary-subtle, icon primary
│   New lead: bg success-subtle, icon success
│
├── Content:
│   ├── Title: text-sm font-medium
│   └── Description: text-xs text-foreground-muted
│
├── Action link (optional): "View" — text-xs text-primary font-medium
└── Close button: text-foreground-subtle, hover text-foreground

Animation:
- Enter: slide up from bottom (translateY 16px → 0), fade in, 250ms ease-out
- Exit: slide right (translateX 0 → 100%), fade out, 200ms ease-in
- Auto-dismiss: 5 seconds (progress bar at bottom, 2px, primary color)
- Stack: multiple toasts stack with 8px gap, max 3 visible
```

### 4.10 Buttons

```
Variants:

Primary (main CTAs):
  bg primary, text white, hover bg primary-hover
  shadow-sm, hover shadow-md
  h-9 px-4 text-sm font-medium rounded-md
  transition all 150ms ease

Secondary (secondary actions):
  bg transparent, border border-card-border, text foreground
  hover bg background-subtle
  h-9 px-4 text-sm font-medium rounded-md

Ghost (inline actions, low emphasis):
  bg transparent, text foreground-secondary
  hover bg background-subtle, text foreground
  h-9 px-4 text-sm font-medium rounded-md

Danger (destructive):
  bg danger, text white, hover bg danger darker
  Only used for confirmed destructive actions

Small variant (all types):
  h-8 px-3 text-xs

Icon button:
  h-9 w-9 (or h-8 w-8 small), rounded-md
  flex items-center justify-center
  icon 16px (or 14px small)

Loading state:
  opacity 70%, cursor not-allowed
  Replace text/icon with small spinner (14px)

Rules:
- Only ONE primary button per visible area
- Destructive buttons require confirmation dialog
- Icon-only buttons must have tooltip
- Button text: sentence case ("Add prospect" not "Add Prospect")
```

### 4.11 Badges & Tags

```
Stage badge:
  inline-flex items-center gap-1.5
  text-xs font-medium
  dot: 6px rounded-full [stage color]
  No background — just dot + text

Status badge (invoices, bookings):
  text-[11px] font-medium px-2 py-0.5 rounded-full
  Paid: bg success-subtle text success
  Pending: bg warning-subtle text warning
  Overdue: bg danger-subtle text danger
  Draft: bg background-subtle text foreground-muted

Tag (on contacts):
  text-xs px-2 py-0.5 rounded-md
  bg background-subtle text foreground-secondary
  hover: bg background-muted (if removable, show × on hover)

Priority badge:
  Urgent: 🔴 text-danger
  High: 🟡 text-warning
  Medium: text-foreground-secondary (no icon)
  Low: text-foreground-muted (no icon)
```

---

## 5. Animation & Micro-Interactions

### Page Transitions

```css
/* Apply to page content wrapper */
@keyframes pageIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.page-enter { animation: pageIn 250ms var(--ease-out) forwards; }
```

### Staggered List Loading

```css
/* For dashboard cards, table rows appearing */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
/* Apply with increasing delay: 0ms, 40ms, 80ms, 120ms... */
```

### Number Count-Up (Dashboard Stats)

```typescript
// Use a hook like useCountUp(targetValue, duration=400)
// Easing: ease-out
// Only triggers on first mount or value change
// Numbers in font-mono for stable width during animation
```

### Hover Interactions

```
Cards: shadow transition 180ms, translateY(-1px) on hover
Buttons: all transitions 150ms
Table rows: bg transition 100ms
Sidebar items: bg + color transition 120ms
Links: color transition 100ms
```

### Skeleton Loading

```
Instead of spinners, show skeleton placeholders that match content layout.

Skeleton base:
  bg background-muted, rounded-md
  animate-pulse (Tailwind built-in)
  
For stat cards: rectangle matching text-2xl height
For table rows: 5 rows of alternating width rectangles
For kanban cards: 3 card-shaped rectangles per column
For timeline: circle + lines pattern

Rule: skeleton layout must match real content layout exactly.
Never show a spinner for page content. Spinners only for:
- Button loading state (inline)
- Saving indicator in topbar
- Modal content loading
```

---

## 6. Responsive Breakpoints

```
Desktop (≥ 1280px): Full layout, sidebar expanded, 4-col stat grid
Laptop (1024-1279px): Sidebar collapsed to icons (64px), 4-col stats
Tablet (768-1023px): Sidebar hidden (hamburger trigger), 2-col stats
                     Kanban: horizontal scroll with snap
Mobile (< 768px): Bottom tab nav (4 items: Dashboard, Prospects, Tasks, More)
                  Kanban: vertical list grouped by stage
                  Tables: card-based layout instead of columns
                  Contact detail: stacked layout, FAB for quick actions
```

---

## 7. Accessibility Checklist

- All interactive elements have `:focus-visible` ring (2px primary)
- Color is never the ONLY way to convey meaning (always pair with icon/text)
- Touch targets minimum 44px on mobile
- Contrast ratios: foreground on background ≥ 4.5:1 (text), ≥ 3:1 (large text, icons)
- Kanban drag-and-drop has keyboard alternative (select card, arrow keys to move)
- All images/icons have aria-labels or are `aria-hidden` if decorative
- Modals trap focus and close on Escape
- Toast notifications have `role="alert"` and `aria-live="polite"`

---

## 8. Dark Mode Implementation

```typescript
// In layout.tsx or a ThemeProvider:
// Use next-themes for seamless toggle

import { ThemeProvider } from "next-themes";

<ThemeProvider attribute="class" defaultTheme="light" enableSystem>
  {children}
</ThemeProvider>

// Toggle button in Settings or topbar:
// Moon icon → Sun icon, transition with rotate animation
```

The `.dark` class in CSS variables handles all color changes. No component needs conditional logic — everything adapts through CSS variables automatically.

---

## 9. Icon System

Use **Lucide React** exclusively. 16px default size, 1.5px stroke.

| Context | Icon | Size |
|---------|------|------|
| Sidebar nav | `LayoutDashboard`, `Users`, `UserCheck`, `GitBranch`, `MessageCircle`, `Mail`, `Calendar`, `Receipt`, `IndianRupee`, `BarChart3`, `Settings` | 18px |
| Quick actions | `Phone`, `MessageSquare`, `Mail`, `CalendarPlus`, `StickyNote`, `Bell` | 16px |
| Table actions | `MoreHorizontal`, `Pencil`, `Trash2`, `ExternalLink` | 14px |
| Status | `Check`, `Clock`, `AlertTriangle`, `X` | 14px |
| Topbar | `Search`, `Bell`, `Plus` | 18px |

Rules:
- Never mix icon libraries
- Icons in buttons: left side, 16px, `mr-2`
- Icon-only buttons: always add `title` and `aria-label`
- Stage colors apply to dots, not icons

---

## 10. Page-Specific Design Notes

### Dashboard
- Greeting text uses actual time of day
- Stat cards: 4 columns desktop, 2 mobile
- "Today's Focus" card is visually prominent — largest card on the page
- Pipeline mini-chart: horizontal bar or funnel shape, not a pie chart
- Recent activity feed: max 5 items, "View all" link to Activity page

### Prospects (Kanban)
- Default view is Kanban (most used), toggle to List
- Funnel selector above Kanban — dropdown, not tabs (supports many funnels)
- Horizontal scroll with scroll-snap for smooth column browsing
- Each column: max ~15 cards visible, then "Show X more" collapse

### Prospects (List)
- Default sort: newest first
- Sticky header row on scroll
- Row click opens contact detail (not a link — full row is clickable)
- Bulk selection: checkbox column, shift-click for range select

### Contact Detail
- No page reload when switching tabs (client-side tab switching)
- Timeline loads most recent 20, paginated on scroll
- Communication tab: threaded view, WhatsApp and email interleaved chronologically
- Copy buttons appear on hover only (clean default, functional on interaction)

### Settings
- Tab-based layout (Profile, Team, Integrations, Notifications)
- Integration cards show connection status: green dot + "Connected" or setup CTA
- Clean form layouts: label above input, max-w-md for text inputs

---

## Quick Reference: Tailwind Classes You'll Use Constantly

```
/* Card */
bg-white border border-gray-200 rounded-xl shadow-sm

/* Page title */
text-xl font-semibold tracking-tight text-gray-900

/* Section title */
text-sm font-semibold text-gray-900

/* Body text */
text-sm text-gray-600

/* Muted text */
text-xs text-gray-400

/* Tiny label */
text-[11px] uppercase tracking-wider font-medium text-gray-400

/* Monospace data */
font-mono text-sm text-gray-600

/* Primary button */
bg-[#4A6CF7] hover:bg-[#3B5AE0] text-white text-sm font-medium
px-4 py-2 rounded-lg shadow-sm transition-all duration-150

/* Ghost button */
text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50
px-3 py-1.5 rounded-md transition-colors duration-100

/* Input */
h-9 w-full rounded-lg border border-gray-200 bg-white px-3
text-sm placeholder:text-gray-400
focus:border-[#4A6CF7] focus:ring-2 focus:ring-[#4A6CF7]/20

/* Badge */
inline-flex items-center gap-1.5 text-xs font-medium

/* Sidebar item */
h-9 px-3 mx-2 rounded-md flex items-center gap-2.5 text-sm
text-gray-400 hover:text-white hover:bg-white/5 transition-colors
```

---

*This design system is the single source of truth for SalesHub's visual language. When in doubt, choose the simpler, quieter option. Restraint is the brand.*

*Last updated: February 26, 2026*
