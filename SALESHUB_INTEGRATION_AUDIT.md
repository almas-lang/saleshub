# SalesHub Integration Audit

_Audited: 2026-05-12. Repo: `saleshub` (this codebase)._

## TL;DR — the question that decides everything

> **Is the booking app (`app.xperiencewave.com/book/...`) part of SalesHub, or a separate system?**

**It is part of SalesHub.** This repo *is* SalesHub — a Next.js 15 + Supabase CRM — and it serves the public booking pages itself at `/book/[slug]` (`src/app/book/[slug]/page.tsx`, `src/components/booking/booking-widget.tsx`, `src/app/api/bookings/route.ts`).

Consequence: most of the "in-booking-flow" data the original doc worried about (who picked a date, who booked, who attended) lives — or *could* live — in SalesHub's own Postgres. You do **not** need a separate GA4 feed for booked/attended/closed. You *do* still want GA4 on the marketing site for pre-form steps, and one in-flow gap remains (abandoned bookings, step 4 below).

The external-website side (`xperiencewave.com`) still calls SalesHub via two webhooks (`/api/webhooks/lead-capture` and `/api/webhooks/lead-capture/update`), so the lead-capture half of the original checklist still applies to whoever owns that site.

---

## Checklist results

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Leads actually arriving | ⚠️ Verify in prod | Webhook exists & is solid; need to compare 7-day count vs GA4 `form_submitted`. |
| 2 | UTM fields stored, not just received | ✅ Mostly | Stored as real columns on `contacts` from the webhook; booking-page UTMs go to `metadata` only (minor inconsistency). |
| 3 | Lifecycle stages auto-update | ⚠️ Partial | "Lead → Booked" auto. "Attended / No-show" exist as `bookings.status` values but **nothing sets them automatically** — manual only. |
| 4 | Abandoned bookings logged | ❌ Not implemented | No record of "picked a slot / answered some questions but didn't confirm", no question-index tracking. |
| 5 | Email is the join key | ✅ Yes | Webhook, booking flow, and update endpoint all key on lowercased/trimmed email. |
| 6 | `lead_id` round-trips | ⚠️ Half | `lead_id` is carried through the booking page URL and into the redirect, but `/api/bookings` matches the contact by **email/phone only** — `lead_id` is never used to bind the booking to the originating lead record. |
| 7 | Portfolio/resume on the contact | ✅ Yes | Accepted at lead capture and via `/api/webhooks/lead-capture/update`; stored in `contacts.metadata`. |
| 8 | Pipeline/funnel reporting | ✅ Yes | Built-in analytics dashboard (overview / leads / pipeline / communication / team) + contacts CSV export. |

---

## Detail

### 1. Leads arriving
- Endpoint: `POST /api/webhooks/lead-capture` (`src/app/api/webhooks/lead-capture/route.ts`).
- Auth: `x-webhook-secret` header **or** `?key=` query param, compared against `SALESHUB_WEBHOOK_SECRET`.
- Does on receipt: dedup (email → phone, including soft-deleted), assign to default funnel's first stage, store UTMs, store form answers in `contact_form_responses`, send welcome email, auto-enroll in drips, and if `call_booked = "yes"` move to the "121 Booked" stage.
- Returns: `{ success, contact_id, is_duplicate, booking_processed }`.
- **Action:** pull last 7 days of `contacts` (or `activities` of type `form_submitted`) and reconcile against GA4 `form_submitted`. A persistent gap = the website's webhook call is failing silently — check the site's `SALESHUB_WEBHOOK_URL` / `SALESHUB_WEBHOOK_SECRET`.

### 2. UTM storage
- `leadCaptureSchema` (`src/lib/validations.ts`) accepts `utm_source/medium/campaign/content/term`; the webhook writes them to dedicated `contacts.utm_*` columns. ✅
- The public booking page (`src/app/book/[slug]/page.tsx`, `TRACKING_KEYS`) also captures `utm_*`, `lead_id`, `fbclid`, `gclid` from the query string, but on the booking path these land in `contacts.metadata`, not the `utm_*` columns.
- **Recommendation (small):** when a booking creates/updates a contact, also populate the `utm_*` columns if empty, so reporting has a single source.

### 3. Lifecycle / pipeline stages
- Models: `funnels`, `funnel_stages` (ordered, colored, terminal flag), `contacts`, `bookings`, `activities`, `contact_form_responses` (`supabase/migrations/001_initial_schema.sql`).
- Auto transitions today: new lead → first stage of default funnel; lead/booking with a booking → "121 Booked"; conversion sets `contacts.converted_at` and `type = customer` (`src/app/api/customers/convert/route.ts`).
- `bookings.status` enum includes `confirmed | cancelled | completed | no_show` — but the only writer is the manual `PATCH /api/bookings/[id]`. There is **no post-call job** that flips a booking to `completed` / `no_show`, and there's no dedicated "Attended" funnel stage.
- **Recommendation:** either (a) a cron that, X hours after a booking's end time, marks it `no_show` unless someone marked it `completed`, plus a corresponding stage move; or (b) wire it to Google Calendar attendance / a manual "attended?" prompt in the booking detail UI. Pick one — without it, the attended/no-show funnel step is unreliable.

### 4. Abandoned bookings
- **Not implemented.** Searched for `abandon`, partial-booking, `question_index` — nothing. The booking widget only writes to the DB on successful confirmation (`POST /api/bookings`). Someone who opens `/book/[slug]`, picks a slot, answers two questions, then leaves leaves no trace.
- **Recommendation:** if this data matters, add lightweight client beacons from `booking-widget.tsx` (`slot_selected`, `question_viewed` with index, `booking_abandoned`) to a new `booking_events` table or to GA4. Cheapest version: just fire the GA4 events (`booking_date_selected`, `booking_question_viewed` w/ `question_index`, `booking_abandoned`, `booking_confirmed`) since SalesHub doesn't currently store any of it.

### 5. Email as join key
- Lead webhook: `email` lowercased/trimmed, primary dedup key. ✅
- Booking: `src/app/api/bookings/route.ts:143` — email pulled from the form, lowercased/trimmed; contact looked up by email, then phone fallback. ✅
- Update endpoint: `POST /api/webhooks/lead-capture/update` keys on `email`. ✅
- Consistent. The one risk is a booking made with a *different* email than the original lead → creates a second contact. See #6.

### 6. `lead_id` round-trip
- The booking page reads `lead_id` from the query string and the widget forwards it (and utm/fbclid/gclid) into the post-booking redirect URL. So as a *URL value* it round-trips fine.
- But `POST /api/bookings` never reads `lead_id` — it find-or-creates the contact purely by email/phone. So if the booking form email ≠ the lead's email, the booking attaches to a brand-new contact and the original lead is orphaned.
- **Recommendation:** have the booking widget submit `lead_id` in the POST body, and in `/api/bookings` prefer matching the contact by `lead_id` (contact id) before falling back to email/phone. Closes the duplicate-contact hole.

### 7. Portfolio / resume
- Accepted by `leadCaptureSchema` (`portfolio_url`, `resume_url`); stored in `contacts.metadata`.
- Updatable post-booking via `POST /api/webhooks/lead-capture/update?key=<secret>` with `{ email, portfolio_url?, resume_url? }` (`src/app/api/webhooks/lead-capture/update/route.ts`) — this is the endpoint the congrats page should hit.
- ✅ Working. They surface on the contact record via `metadata`. (Not in the default CSV export column list — add them if exports need them.)

### 8. Reporting
- Built-in: `src/app/(app)/analytics/*` — Overview, Leads (source breakdown, funnel conversion), Pipeline (stage-by-stage conversion), Communication, Team; Finance reports (P&L / revenue / GST); paid-traffic attribution overrides.
- CSV: `GET /api/contacts/export` — includes created date, source, stage, `utm_source/medium/campaign`, etc. (add `portfolio_url`/`resume_url` from metadata if needed).
- ✅ Pipeline funnel by stage/source/date is available in-app; CSV export exists.

---

## Env vars

| Var | Where it belongs | Status here |
|-----|------------------|-------------|
| `SALESHUB_WEBHOOK_SECRET` | This app (SalesHub) — validates inbound webhooks | ✅ set in `.env.local`; **confirm it's also set in Vercel prod** and matches the website's value |
| `SALESHUB_WEBHOOK_URL` | The **marketing website** project, not this repo | n/a here — verify on `xperiencewave.com`'s Vercel project |
| `SALESHUB_LEAD_UPDATE_URL` | The **marketing website** project, not this repo | n/a here — should point at `…/api/webhooks/lead-capture/update` |
| `CRON_SECRET` | This app | ✅ used by `/api/cron/*` |
| Supabase / Google / Stripe / Cashfree / Resend keys | This app | present per code; not all visible in `.env.local` — confirm in Vercel prod |

## Congrats redirect contract (as implemented)
`booking-widget.tsx` appends, when the booking page has a `redirect_url`:
`?booked=true&date=YYYY-MM-DD&time=HH:MM&duration=<min>&meet_link=<google_meet_url>&email=<form_email>` plus all tracking params (`utm_*`, `lead_id`, `fbclid`, `gclid`).
This is a superset of the doc's `date/time/duration/meet_link/email/first_name` — the only missing param is **`first_name`**; add it to the redirect if the congrats page needs it (currently it would have to read the name from the form or skip it).

## GA4
- No GA4 tag (`G-26R787N9N5` or otherwise) is loaded by this app's layout. The booking widget calls `window.gtag(...)` defensively (events like `booking_explorer_redirect`) **only if a gtag is already on the page** — i.e. it expects the hosting/marketing domain to load GA4. If `/book/[slug]` is served on a domain without GA4, those events are dropped.
- **Recommendation:** if booking analytics matter, either add the GA4 tag to `src/app/book/[slug]/page.tsx` (scoped to the booking route) or accept that booking-flow events only fire when embedded under the marketing domain.

---

## Prioritized fixes

1. **`lead_id` binding in `/api/bookings`** — prevents duplicate contacts; small, high value.
2. **Attended / no-show automation** — cron or UI prompt to set `bookings.status`; needed for an honest attended funnel step.
3. **Abandoned-booking events** — at minimum fire the four GA4 events from the booking widget; optionally persist to a `booking_events` table.
4. **`first_name` in the congrats redirect** — one-line addition.
5. **Mirror booking-path UTMs into `contacts.utm_*` columns** — reporting consistency.
6. **Ops:** verify `SALESHUB_WEBHOOK_SECRET` (and all third-party keys) are set in Vercel production; reconcile 7-day lead count vs GA4 `form_submitted`.
