# SalesHub — Page Layout Concepts

> **For:** Almas — feed this to Claude Code alongside DESIGN_SYSTEM.md when building these pages
> **These are the two most important screens in the app. Get them right.**

---

## 1. Dashboard — "Your Morning Ritual"

### Design Philosophy

This is the first screen you see every day. It should feel like opening a luxury car's instrument cluster — everything you need, nothing you don't. The goal is **zero clicks to know where you stand**. You glance at it for 10 seconds and know: how many new leads, who needs follow-up, how much money came in, and what you should do first.

It is NOT a wall of charts. It's a focused **action-oriented briefing**.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  Good afternoon, Murad                     Wed, 26 Feb 2026 │
│  ░░░░░░░░░░░░░░░░░░░░                                       │
│                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐│
│  │ NEW LEADS  │ │ FOLLOW-UPS │ │  REVENUE   │ │  OVERDUE   ││
│  │            │ │            │ │            │ │            ││
│  │     12     │ │      5     │ │   ₹1.2L   │ │    2  ⚠️   ││
│  │   today    │ │    due     │ │ this month │ │   tasks    ││
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  TODAY'S FOCUS                                    See all ││
│  │                                                          ││
│  │  🔴  Call Sameer Korde — follow up overdue (2 days)      ││
│  │      +91 88982 84312  ·  VSL Flow  ·  121 Done           ││
│  │                                                          ││
│  │  🟡  Mohit Gangrade — 121 call at 2:30 PM today          ││
│  │      +91 88712 02245  ·  VSL Flow  ·  121 Booked         ││
│  │                                                          ││
│  │  🟢  Send invoice to Prakash — converted yesterday       ││
│  │      +91 73974 77616  ·  VSL Flow  ·  Converted          ││
│  │                                                          ││
│  │  ○   Review 3 new leads from morning campaign            ││
│  │      Arrived between 8:00 AM – 11:30 AM                  ││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────┐  ┌────────────────────────────┐│
│  │  PIPELINE HEALTH         │  │  RECENT ACTIVITY           ││
│  │                          │  │                            ││
│  │  VSL Flow                │  │  ● Riya Patel submitted    ││
│  │                          │  │    lead form        2m ago ││
│  │  New Lead ━━━━━━━━ 12    │  │                            ││
│  │  Contacted ━━━━━━ 8      │  │  ● Aman moved to           ││
│  │  121 Booked ━━━━ 5       │  │    121 Done        28m ago ││
│  │  121 Done ━━━ 3          │  │                            ││
│  │  Proposal ━━ 2           │  │  ● Payment received ₹15K  ││
│  │  Converted ━ 1           │  │    from Subhadra    1h ago ││
│  │                          │  │                            ││
│  │  Conversion: 12 → 1 (8%) │  │  ● Email campaign          ││
│  │  Avg time: 12 days       │  │    "Day 3" sent to   4 hrs ││
│  │                          │  │    28 contacts       ago   ││
│  └──────────────────────────┘  │                            ││
│                                │  View all →                ││
│                                └────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Section-by-Section Implementation

#### Greeting Section

```
Position: top of page, mb-6
Left-aligned, no card — just text on the page background

Line 1: "Good afternoon, Murad"
  text-xl font-semibold text-foreground tracking-tight
  
  Time logic:
    5 AM – 12 PM  → "Good morning"
    12 PM – 5 PM  → "Good afternoon"  
    5 PM – 9 PM   → "Good evening"
    9 PM – 5 AM   → "Working late"
  
  Use first name from auth user profile.

Line 2: "Wednesday, 26 Feb 2026"
  text-sm text-foreground-muted mt-0.5
  Format: full weekday, day month year
  Use date-fns: format(new Date(), "EEEE, dd MMM yyyy")
```

#### Stat Cards Row

```
Layout: grid grid-cols-4 gap-4 (grid-cols-2 on mobile)
Each card is independently clickable — navigates to relevant view.

Card structure:
┌─────────────────────────┐
│ NEW LEADS               │  ← label
│                         │
│ 12                      │  ← value (animated count-up)
│ today                   │  ← subtext
└─────────────────────────┘

Implementation:
  bg card, border card-border, rounded-xl, p-5
  shadow: card-shadow
  hover: card-shadow-hover + translateY(-1px), cursor-pointer
  transition: all 180ms ease

  Label: text-[11px] uppercase tracking-wider font-medium text-foreground-muted
  Value: text-2xl font-bold font-mono tracking-tight mt-1
         color: foreground (default) or danger (for overdue card)
  Subtext: text-xs text-foreground-subtle mt-0.5

  Animation on mount:
    Each card fades in with stagger: 0ms, 50ms, 100ms, 150ms
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    Numbers count up from 0 → target over 500ms, ease-out
    Currency values count up too: ₹0 → ₹1,20,000

  Special styling per card:
    New Leads: default styling. Click → /prospects?sort=newest
    Follow-ups: default. Click → /prospects with tasks-due filter
    Revenue: value uses font-mono. Click → /invoices?status=paid
    Overdue: left border 3px var(--danger). ⚠️ icon after number.
             Click → tasks view filtered to overdue

  When value is 0:
    Number shown in text-foreground-muted, not bold
    Subtext changes: "none today" / "all clear ✓" / "₹0" / "none 🎉"
```

#### Today's Focus (The Star Section)

```
This is the most important element on the dashboard. It answers:
"What should I do RIGHT NOW?"

It is NOT a generic task list. It's a smart, prioritized action list
that combines overdue follow-ups, upcoming meetings, pending actions,
and new leads into one ranked list.

Card: bg card, border card-border, rounded-xl, p-5
      This card is wider than stat cards — spans full content width.

Header row: flex items-center justify-between mb-4
  Left: "Today's Focus" — text-sm font-semibold text-foreground
  Right: "See all" — text-xs text-primary hover:underline, links to /tasks

Items: flex flex-col gap-1

Each item:
┌──────────────────────────────────────────────────────────────┐
│ 🔴  Call Sameer Korde — follow up overdue (2 days)           │
│     +91 88982 84312  ·  VSL Flow  ·  121 Done                │
└──────────────────────────────────────────────────────────────┘

Structure: 
  padding: py-3 px-3, rounded-lg
  hover: bg background-subtle, cursor pointer
  click: navigates to contact detail page
  
  First item (most urgent): bg primary-subtle by default (highlighted)
  
  Row 1: flex items-center gap-2
    Priority icon:
      🔴 = overdue (tasks past due date)
      🟡 = due today (meetings, tasks due today)
      🟢 = positive action (conversions, payments to collect)
      ○  = informational (new leads to review)
    
    Text: text-sm font-medium text-foreground
      Format: "{Action verb} {Contact name} — {context}"
      Examples:
        "Call Sameer Korde — follow up overdue (2 days)"
        "Mohit Gangrade — 121 call at 2:30 PM today"
        "Send invoice to Prakash — converted yesterday"
        "Review 3 new leads from morning campaign"
  
  Row 2: flex items-center gap-1.5 mt-0.5
    text-xs text-foreground-subtle
    Phone (font-mono)  ·  Funnel name  ·  Stage name (with stage dot)
    OR
    Contextual detail: "Arrived between 8:00 AM – 11:30 AM"

Priority ranking algorithm (build this server-side):
  1. Overdue follow-up tasks (sorted by days overdue, descending)
  2. Meetings happening today (sorted by time, ascending)
  3. Hot leads needing action (financially ready + urgent, no contact in 24h)
  4. Newly converted prospects needing invoice
  5. New leads from today (grouped: "Review X new leads")

Max items shown: 6. If more, "See all" links to full task view.

Empty state: 
  "All caught up! No urgent actions right now."
  Subtle checkmark icon, text-foreground-muted
  But also: "You have X leads in pipeline" as a soft nudge
```

#### Pipeline Health Card

```
Position: bottom-left, ~55% width

Card: bg card, border card-border, rounded-xl, p-5

Header: flex items-center justify-between mb-4
  "Pipeline Health" — text-sm font-semibold
  Funnel selector dropdown — text-xs, if multiple funnels exist

Content: horizontal bar visualization

  Each stage row: flex items-center gap-3 mb-2
    Stage name: w-24 text-xs text-foreground-muted text-right
    Bar: flex-1 h-2 rounded-full bg-background-muted
      Fill: rounded-full h-2, background [stage color]
            width proportional to count (percentage of total)
            transition width 500ms ease-out on mount
    Count: w-8 text-xs font-mono text-foreground-secondary text-right

  Below bars: mt-4 pt-4 border-t border-card-border
    Two stats side by side:
    "Conversion: 12 → 1 (8%)" — text-xs text-foreground-muted
      The percentage uses: 
        success color if > 15%
        warning color if 5-15%
        danger color if < 5%
    "Avg time: 12 days" — text-xs text-foreground-muted

  On hover over a bar: tooltip showing exact count and % of total
  Click on a stage: navigates to /prospects filtered by that stage
```

#### Recent Activity Card

```
Position: bottom-right, ~45% width

Card: bg card, border card-border, rounded-xl, p-5

Header: "Recent Activity" — text-sm font-semibold mb-4

Content: vertical timeline, max 5 items

  Each entry: flex gap-3 py-2
    Timeline dot: 
      8px rounded-full, colored by activity type:
        lead form submitted → success
        stage change → primary  
        payment received → success
        email campaign → info
        call logged → warning
        note added → foreground-muted
      
      Connecting line: 1px bg-card-border, 
        spans from bottom of dot to top of next dot
        (use pseudo-element on the container)
    
    Content: flex-1
      Row 1: text-sm text-foreground
        ● icon inline with type color
        Description: "Riya Patel submitted lead form"
        Bold the contact name: font-medium
      
      Row 2: text-xs text-foreground-subtle
        Relative time: "2 minutes ago", "1 hour ago"
        
    Amount (if payment): text-sm font-mono text-success font-medium
      Aligned to the right: "₹15,000"

Footer: border-t border-card-border mt-2 pt-3
  "View all →" — text-xs text-primary hover:underline
  Links to a full activity feed (future: /analytics or /activity)

Real-time updates:
  New activities should slide in from the top with fadeInDown animation
  Use Supabase realtime subscription on the activities table
  When a new lead comes in, a toast ALSO appears (see Toast spec)
```

### Dashboard Data Fetching Strategy

```
Server-side rendering for initial load (fast first paint):

1. Stat cards: 4 parallel queries
   - SELECT COUNT(*) FROM contacts WHERE created_at >= today AND type = 'prospect'
   - SELECT COUNT(*) FROM tasks WHERE status = 'pending' AND due_at <= today
   - SELECT SUM(total) FROM invoices WHERE paid_at >= first_of_month AND status = 'paid'
   - SELECT COUNT(*) FROM tasks WHERE status = 'overdue'

2. Today's Focus: compound query
   - Tasks due today or overdue, joined with contacts
   - Bookings happening today, joined with contacts
   - Contacts with type='prospect', converted_at = yesterday (need invoice)
   - Contacts created today, grouped by count
   - Sort by priority algorithm (see above)

3. Pipeline: 
   - SELECT funnel_stages.name, COUNT(contacts.id) 
     FROM contacts JOIN funnel_stages 
     GROUP BY stage, ordered by stage.order

4. Recent activity:
   - SELECT * FROM activities ORDER BY created_at DESC LIMIT 5
     JOIN contacts for names

Client-side: Supabase realtime subscription for live updates
  Subscribe to: activities (new inserts), contacts (new inserts), tasks (status changes)
  On new activity: prepend to Recent Activity, update stat cards
```

---

## 2. Contact Detail Page — "The 360° View"

### Design Philosophy

This page is the answer to "I don't know anything about this person." Every interaction, every message, every note, every payment — all in one place. The design must make it effortless to **scan** (at a glance, understand who this person is) and **act** (call, message, follow up — one click away).

The page has two zones: the **identity zone** (fixed at top, always visible) and the **exploration zone** (tabbed content below). You never lose sight of who you're looking at.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ← Prospects                                                │
│                                                              │
│  ┌──────────────────────────────────────┐  ┌──────────────┐ │
│  │                                      │  │              │ │
│  │  ┌────┐                              │  │ QUICK        │ │
│  │  │ MG │  Mohit Gangrade              │  │ ACTIONS      │ │
│  │  └────┘                              │  │              │ │
│  │         mohit@gmail.com          📋  │  │ 📞 Call      │ │
│  │         +91 88712 02245          📋  │  │ 💬 WhatsApp  │ │
│  │         linkedin.com/in/mohit    ↗   │  │ ✉️  Email    │ │
│  │                                      │  │ 📅 Schedule  │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────┐ │  │ 📝 Note     │ │
│  │  │ Prospect │ │ VSL Flow │ │121   │ │  │ 🔔 Follow-up│ │
│  │  └──────────┘ └──────────┘ │Done  │ │  │              │ │
│  │                            └──────┘ │  └──────────────┘ │
│  │  Assigned to: Murad  ·  12 Jan 2026 │                    │
│  │                                      │                    │
│  └──────────────────────────────────────┘                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Overview │ Timeline │ Communication │ Bookings │ Notes   ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│          [Tab content renders here — see below]              │
│                                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Identity Zone (Header)

```
Layout: flex gap-6 items-start (stacks on mobile)

LEFT SECTION — Contact Card (flex-1):

  Back link: mb-4
    "← Prospects" (or "← Customers" depending on contact type)
    text-sm text-foreground-muted hover:text-foreground
    flex items-center gap-1.5
    On click: router.back() or /prospects

  Header row: flex items-center gap-4
    Avatar: 
      w-12 h-12 rounded-full bg-primary
      flex items-center justify-center
      text-lg font-semibold text-white
      Shows initials: "MG" for Mohit Gangrade
      (Future: if contact has profile photo, show that instead)
    
    Name + contact info:
      Name: text-xl font-semibold text-foreground tracking-tight
      
      Contact details: flex flex-col gap-0.5 mt-1
        Each line: flex items-center gap-2 group
          
          Email: text-sm text-foreground-secondary
            Copy button: opacity-0 group-hover:opacity-100
              transition opacity 150ms
              14px clipboard icon, text-foreground-muted
              On click: copy to clipboard, show brief "Copied!" tooltip
              Tooltip: position absolute, -top-8, bg foreground, text-white
                       text-[11px] px-2 py-1 rounded-md
                       Fades in 100ms, auto-hides after 1.5s
          
          Phone: text-sm font-mono text-foreground-secondary
            Same copy button behavior
            ALSO: clicking the phone number itself opens WhatsApp
              (https://wa.me/91XXXXXXXXXX)
          
          LinkedIn: text-sm text-primary hover:underline
            External link icon (12px) after the text
            Opens in new tab

  Tags row: flex flex-wrap items-center gap-2 mt-3
    Type badge: 
      "Prospect" → bg primary-subtle text-primary
      "Customer" → bg success-subtle text-success
      text-xs font-medium px-2.5 py-0.5 rounded-full
    
    Funnel badge:
      "VSL Flow" → bg background-subtle text-foreground-secondary
      text-xs px-2.5 py-0.5 rounded-md
    
    Stage badge:
      Dot (6px, rounded-full, stage color) + stage name
      text-xs font-medium
      The dot should use the exact --stage-* color variable
    
    Source (if available):
      text-xs text-foreground-subtle
      "via ld-home-popup"

  Meta row: mt-2
    text-xs text-foreground-subtle
    "Assigned to Murad  ·  Created 12 Jan 2026  ·  Last activity 2 hours ago"
    "Murad" is a clickable link (or just bold text for now)
    Separator: " · " (middle dot with spaces)


RIGHT SECTION — Quick Actions (w-48, flex-shrink-0):

  On desktop: vertical stack of action buttons, right-aligned
  On mobile: transforms to a floating action button (FAB)
    at bottom-right, expands on tap to show actions

  Container: flex flex-col gap-1.5

  Each action button:
    flex items-center gap-2.5 h-9 px-3 w-full
    rounded-lg border border-card-border
    text-sm text-foreground-secondary
    hover: bg background-subtle text-foreground
    transition: all 120ms ease
    cursor-pointer
    icon: 16px, left side

  Actions:
    📞 Call       — opens tel: link (or logs a call dialog)
    💬 WhatsApp   — opens wa.me link for their phone number
    ✉️  Email     — opens email compose modal (Phase 2, disabled until then)
    📅 Schedule   — opens "Schedule Follow-up" form
    📝 Add Note   — opens inline note input (expands below the button)
    🔔 Follow-up  — opens "Create Task" modal with contact pre-filled
  
  Follow-up special state:
    If an active follow-up task exists for this contact:
      The button changes to show the due date:
      "🔔 Follow-up due Wed" — text-warning if due soon, text-danger if overdue
      Click opens the existing task for editing
    If no follow-up:
      Normal "🔔 Follow-up" button

  Disabled state (Phase 2+ features):
    opacity-50, cursor-not-allowed
    Tooltip on hover: "Available in the next update"
```

### Tab Navigation

```
Position: below identity zone, mt-6
Full width, border-b border-card-border

Tabs: flex gap-0 (no gap — tabs are flush)

Each tab:
  py-2.5 px-4 text-sm cursor-pointer
  transition: color 150ms
  position: relative (for active indicator)

  Inactive:
    text-foreground-muted
    hover: text-foreground-secondary
  
  Active:
    text-foreground font-medium
    Bottom border: 2px solid var(--primary)
      Positioned via pseudo-element, bottom -1px (overlaps the container border)
      
  Active indicator animation:
    When switching tabs, the bottom border slides horizontally
    from the previous tab position to the new one.
    Use a separate div with position absolute, 
    width and left animated with transition 200ms ease-out.
    This is the "ink bar" pattern — feels polished.

Tab list:
  [Overview] [Timeline] [Communication] [Bookings] [Invoices] [Notes]
  
  Phase 1: Overview, Timeline, Notes are functional
  Phase 2: Communication, Bookings become functional
  Phase 3: Invoices becomes functional
  
  Non-functional tabs: still visible, but show empty state when clicked
  "Communication will be available soon" etc.

Tab content area: mt-6
  No card wrapper — content sits directly on the page background
  Each tab manages its own card layouts
```

### Tab: Overview

```
Layout: grid grid-cols-1 lg:grid-cols-2 gap-6

LEFT COLUMN — Qualifying Data:

  Card: bg card, border card-border, rounded-xl, p-5
  
  Header: "Qualifying Data" — text-sm font-semibold mb-4
  
  Only shown if contact_form_responses exists for this contact.
  If no form data: show subtle message "No qualifying data yet"
  
  Field rows: divide-y divide-card-border
    Each row: flex justify-between items-center py-3 first:pt-0 last:pb-0
      
      Label: text-sm text-foreground-muted
      Value: text-sm text-foreground font-medium text-right max-w-[60%]
      
      Fields:
        Experience → "3-5 years"
        Current Role → "UI/UX Designer" 
        Key Challenge → "Low salary, wants MNC"
        Desired Salary → "₹80k – ₹1L"
        Financial Readiness:
          "Ready" → ✅ text-success font-medium
          "Careful but open" → ⚠️ text-warning
          "Not ready" → text-danger
        Urgency:
          "Right now" → 🔥 text-warning font-medium
          "Within 90 days" → ⏳ text-foreground-secondary
          "More than 90 days" → text-foreground-muted
        What's Stopping Them → longer text, wraps to multiple lines
          text-right removed, display as block below label instead
          text-sm text-foreground-secondary, italic

  This card is GOLD for salespeople. Before a call, glance at this
  and you know: their experience, challenge, budget, and urgency.
  Design it to be scannable in 3 seconds.


RIGHT COLUMN — Quick Stats + Tags:

  Stats card: bg card, border card-border, rounded-xl, p-5
    Header: "Activity Summary" — text-sm font-semibold mb-4
    
    Stats grid: grid grid-cols-2 gap-4
      Each stat:
        Value: text-lg font-semibold font-mono text-foreground
        Label: text-xs text-foreground-muted mt-0.5
      
      Stats:
        "14" — Total interactions
        "22 days" — Days in pipeline
        "3/5" — Emails opened (opened/sent ratio)
        "Feb 24" — Last contact date
          Color-coded:
            < 2 days ago → text-success
            2-4 days ago → text-warning
            5+ days ago → text-danger
  
  Tags card: bg card, border card-border, rounded-xl, p-5, mt-4
    Header: "Tags" — text-sm font-semibold mb-3
      + "Edit" link: text-xs text-primary, right-aligned
    
    Tags: flex flex-wrap gap-1.5
      Each tag: text-xs px-2.5 py-1 rounded-md
               bg background-subtle text-foreground-secondary
      On edit mode: tags become removable (× button appears)
                    + input field to add new tags
```

### Tab: Timeline

```
This is the COMPLETE history of every interaction with this person.
WhatsApp messages, emails, calls, stage changes, notes, payments — 
all interleaved chronologically. This is what you've been missing.

Layout: max-w-2xl (don't stretch timeline to full width — hard to read)

Timeline structure:
  Each entry: flex gap-4 relative

    Timeline line:
      Vertical 1px line, bg card-border
      Runs continuously from first entry to last
      Implementation: absolute left-[15px] top-8 bottom-0 w-px bg-card-border
      on the container, not on individual items
    
    Icon circle: 
      w-8 h-8 rounded-full flex-shrink-0
      flex items-center justify-center
      z-10 (above the line)
      
      Colors by type:
        stage_change  → bg primary-subtle, icon primary (ArrowRight)
        email_sent    → bg info-subtle, icon info (Mail)
        email_opened  → bg info-subtle, icon info (MailOpen)
        wa_sent       → bg success-subtle, icon success (MessageCircle)
        wa_read       → bg success-subtle, icon success (CheckCheck)
        call          → bg warning-subtle, icon warning (Phone)
        note          → bg background-subtle, icon foreground-muted (StickyNote)
        booking       → bg primary-subtle, icon primary (Calendar)
        payment       → bg success-subtle, icon success (IndianRupee)
        form_submitted → bg primary-subtle, icon primary (FileText)
      
      Icon: 14px Lucide icon centered in circle
    
    Content: flex-1 pb-6 (spacing between entries)
      
      Title: text-sm text-foreground
        Bold the key info: contact name or action
        
        Examples:
          "Moved from <b>121 Booked</b> to <b>121 Done</b>"
          "Email sent: <b>Day 3 - Have you watched the training?</b>"
          "WhatsApp template <b>xw_book_24</b> sent ✓✓"
          "Call logged — 45 minutes"
          "Note added"
          "Payment received: <b>₹15,000</b>"
          "Booking confirmed for <b>26 Feb, 2:30 PM</b>"
          "Lead form submitted"
      
      Body (if exists): text-sm text-foreground-secondary mt-1
        For notes: the full note text
        For calls: call notes/outcome
        For emails: subject line
        For WhatsApp: template name or message preview (truncated)
      
      Metadata row: flex items-center gap-3 mt-1.5
        Time: text-xs text-foreground-subtle
          "2 hours ago" (if today)
          "Yesterday at 3:30 PM" (if yesterday)
          "12 Jan 2026, 10:15 AM" (if older)
        
        User: text-xs text-foreground-subtle
          "by Murad" or "by System" (for automated actions)
        
        Status indicators (for messages):
          Email: "Opened" in text-success or "Not opened" in text-foreground-muted
          WhatsApp: ✓ sent, ✓✓ delivered, ✓✓ (blue) read
          
      Expandable content (for long notes/emails):
        If body > 3 lines, truncate with "Show more" link
        Clicking expands smoothly (height animation, 200ms)

  Pagination:
    Initial load: 20 most recent activities
    "Load more" button at bottom (not infinite scroll — user controls it)
    Or: intersection observer for lazy loading if preferred

  Empty state:
    centered in timeline area
    "No activity yet with Mohit"
    "Make the first move — call, message, or add a note."
    Quick action buttons: [📞 Call] [💬 WhatsApp] [📝 Note]
```

### Tab: Notes

```
Simple, powerful notes for this contact.

Layout:
  
  New note input (always visible at top):
    Textarea: min-h-[80px] w-full rounded-xl border border-card-border
      p-4 text-sm placeholder "Add a note about Mohit..."
      focus: border-primary ring-2 ring-primary/20
      resize-y (user can drag to expand)
    
    Below textarea: flex justify-between items-center mt-2
      Left: text-xs text-foreground-muted "Press ⌘+Enter to save"
      Right: Save button (primary, small variant)
    
    On save:
      Note appears at top of list with slide-in animation
      Textarea clears
      Activity logged in timeline
      Toast: "Note saved"
  
  Notes list: mt-6 flex flex-col gap-3
    Each note:
      bg card, border card-border, rounded-xl, p-4
      
      Content: text-sm text-foreground whitespace-pre-wrap
        (preserves line breaks from textarea)
      
      Footer: flex items-center justify-between mt-3
              border-t border-card-border pt-3
        Left: text-xs text-foreground-subtle
          "Murad · 2 hours ago"
        Right: flex gap-2
          Edit icon (14px, ghost button)
          Delete icon (14px, ghost button, text-danger on hover)
          Both: opacity-0 group-hover:opacity-100
    
    Empty state:
      "No notes yet. Add context about your conversations with Mohit."
```

### Mobile Adaptation

```
On mobile (< 768px):

Identity zone:
  - Stack vertically (remove flex row)
  - Avatar + name row stays horizontal (flex)
  - Contact details stack below
  - Quick Actions become a FAB (floating action button):
      Fixed bottom-right, 48px, rounded-full, bg primary, shadow-lg
      Icon: "+" or "⚡"
      On tap: expands to radial menu or bottom sheet with action list
      Bottom sheet preferred: slides up, shows all 6 actions as a list

Tabs:
  - Horizontal scroll with overflow-x-auto
  - Active tab indicator still works
  - Reduced padding: px-3 instead of px-4

Tab content:
  - Overview: single column (remove grid)
  - Timeline: reduce left padding, smaller icons (24px)
  - Notes: textarea takes full width
```

---

## Design Principles to Remember

1. **The Dashboard exists for action, not admiration.** Every element should answer "what do I do next?" If it doesn't, remove it.

2. **The Contact Detail page is a conversation, not a form.** The timeline IS the page. Everything else is context for the timeline.

3. **Copy buttons on email and phone are worth their weight in gold.** You'll copy a phone number 50 times a day. Make it one click.

4. **Color means something.** Red = overdue/urgent. Amber = needs attention. Green = positive/success. Blue = informational/primary. Never use color randomly.

5. **Animate intentionally.** Count-up numbers on dashboard = delight. Slide-in timeline entries = awareness. But never animate something the user didn't trigger or doesn't need to notice.

6. **Empty states are first impressions.** The first time you open Prospects, it's empty. That moment determines whether the tool feels dead or alive. Design it.

---

*Feed this file to Claude Code when building the Dashboard page or the Contact Detail page.*
*Reference: DESIGN_SYSTEM.md for colors, typography, and component specs.*
*Reference: ARCHITECTURE.md for database schema and data relationships.*
