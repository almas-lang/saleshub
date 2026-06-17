/**
 * v2 outbox drainer — turns queued sends into real sends.
 *
 * Reuses the existing Resend (sendEmail) and WhatsApp (sendTemplate) clients.
 * Adds: exactly-once (rows are enqueued with a unique idempotency_key), retry with
 * backoff, and a dead-letter state after MAX_ATTEMPTS. `dryRun` resolves everything
 * but does not call the send APIs or write status — used to verify safely.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, renderVariables, getUnsubscribeUrl } from "@/lib/email/client";
import { renderDripEmail } from "@/lib/email/templates/drip-wrapper";
import { sendTemplate } from "@/lib/whatsapp/client";
import { buildGoogleCalendarUrl, buildAppleCalendarUrl } from "@/lib/calendar-links";
import { logger } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any;

const BATCH = 50;
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = [5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000]; // 5m, 30m, 2h, 6h

export interface DrainResult { sent: number; failed: number; dead: number; skipped: number }

function backoff(attempts: number): string {
  return new Date(Date.now() + (BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)])).toISOString();
}

/** Resolve {{booking_*}} / calendar-link variables for a contact (maybeSingle — no silent fallback). */
async function bookingVars(contactId: string, now: string): Promise<Record<string, string>> {
  const sel = "starts_at, ends_at, meet_link, booking_pages(slug, title, availability_rules)";
  const { data: upcoming } = await sb.from("bookings").select(sel)
    .eq("contact_id", contactId).eq("status", "confirmed").gte("starts_at", now)
    .order("starts_at", { ascending: true }).limit(1).maybeSingle();
  const { data: fallback } = !upcoming
    ? await sb.from("bookings").select(sel)
        .eq("contact_id", contactId).eq("status", "confirmed")
        .order("starts_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const booking = upcoming || fallback;
  if (!booking) return {};
  const dt = new Date(booking.starts_at);
  const endDt = new Date(booking.ends_at);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bp = (booking as any).booking_pages;
  const tz = (bp?.availability_rules as { timezone?: string } | null)?.timezone ?? "Asia/Kolkata";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://app.xperiencewave.com");
  const title = bp?.title || "Strategy Call";
  return {
    booking_date: dt.toLocaleDateString("en-US", { timeZone: tz, day: "2-digit", month: "short", year: "numeric" }),
    booking_time: dt.toLocaleTimeString("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true }),
    booking_meet_link: booking.meet_link || "Not available",
    ...(bp?.slug ? { booking_reschedule_link: `${baseUrl}/book/${bp.slug}` } : {}),
    google_calendar_link: buildGoogleCalendarUrl({ title, startsAt: dt, endsAt: endDt, meetLink: booking.meet_link }),
    apple_calendar_link: buildAppleCalendarUrl({ title, startsAt: dt, endsAt: endDt, meetLink: booking.meet_link, baseUrl }),
  };
}

async function markResult(table: string, id: string, ok: boolean, attempts: number, messageId: string | null, error: string | null) {
  if (ok) {
    await sb.from(table).update({ status: "sent", sent_at: new Date().toISOString(), ...(table === "email_sends" ? { resend_message_id: messageId } : { wa_message_id: messageId }) }).eq("id", id);
    return "sent";
  }
  const next = attempts + 1;
  if (next >= MAX_ATTEMPTS) {
    await sb.from(table).update({ status: "dead", attempts: next, error_message: error?.slice(0, 200) ?? null }).eq("id", id);
    return "dead";
  }
  await sb.from(table).update({ status: "queued", attempts: next, next_attempt_at: backoff(next), error_message: error?.slice(0, 200) ?? null }).eq("id", id);
  return "failed";
}

export async function drainOutbox(opts: { dryRun?: boolean; limit?: number } = {}): Promise<DrainResult> {
  const now = new Date().toISOString();
  const limit = opts.limit ?? BATCH;
  const res: DrainResult = { sent: 0, failed: 0, dead: 0, skipped: 0 };

  // ── EMAIL ──
  const { data: eq } = await sb.from("email_sends")
    .select("id, contact_id, campaign_id, step_id, attempts, idempotency_key")
    .eq("status", "queued").or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .not("idempotency_key", "is", null) // v2 rows only
    .order("created_at", { ascending: true }).limit(limit);

  for (const row of eq ?? []) {
    const { data: contact } = await sb.from("contacts").select("email, first_name, last_name, company_name, deleted_at, email_unsubscribed_at").eq("id", row.contact_id).maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: step } = await sb.from("unified_steps").select("subject, body_html, preview_text, plain_text").eq("id", row.step_id).maybeSingle();
    if (!contact || contact.deleted_at || !contact.email || contact.email_unsubscribed_at || !step) {
      if (!opts.dryRun) await sb.from("email_sends").update({ status: "failed" }).eq("id", row.id);
      res.skipped++; continue;
    }
    const vars: Record<string, string> = {
      first_name: contact.first_name || "there", last_name: contact.last_name || "",
      company_name: contact.company_name || "your company", unsubscribe_link: getUnsubscribeUrl(row.contact_id),
    };
    const content = `${step.subject ?? ""} ${step.body_html ?? ""} ${step.preview_text ?? ""}`;
    if (content.includes("{{booking_") || content.includes("{{google_calendar_link}}") || content.includes("{{apple_calendar_link}}")) Object.assign(vars, await bookingVars(row.contact_id, now));
    const { subject, html } = await renderDripEmail({
      subject: renderVariables(step.subject ?? "", vars), bodyHtml: renderVariables(step.body_html ?? "", vars),
      preview: step.preview_text ? renderVariables(step.preview_text, vars) : undefined, plainText: !!step.plain_text,
    });
    if (opts.dryRun) { res.sent++; continue; }
    const r = await sendEmail({ to: contact.email, subject, html, tags: [{ name: "campaign_id", value: row.campaign_id ?? "" }, { name: "step_id", value: row.step_id }] });
    const outcome = await markResult("email_sends", row.id, r.success, row.attempts ?? 0, r.messageId ?? null, r.success ? null : (r.error ?? "email_failed"));
    res[outcome as "sent" | "failed" | "dead"]++;
  }

  // ── WHATSAPP ──
  const { data: wq } = await sb.from("wa_sends")
    .select("id, contact_id, campaign_id, step_id, attempts, idempotency_key")
    .eq("status", "queued").or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .not("idempotency_key", "is", null)
    .order("created_at", { ascending: true }).limit(limit);

  for (const row of wq ?? []) {
    const { data: contact } = await sb.from("contacts").select("phone, email, first_name, last_name, company_name, deleted_at").eq("id", row.contact_id).maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: step } = await sb.from("unified_steps").select("wa_template_name, wa_template_language, wa_template_params, wa_template_param_names").eq("id", row.step_id).maybeSingle();
    if (!contact || contact.deleted_at || !contact.phone || !step?.wa_template_name) {
      if (!opts.dryRun) await sb.from("wa_sends").update({ status: "failed" }).eq("id", row.id);
      res.skipped++; continue;
    }
    const rawParams = (step.wa_template_params ?? []) as string[];
    const bvars = rawParams.some((p) => p.includes("{{booking_") || p.includes("{{google_calendar_link}}") || p.includes("{{apple_calendar_link}}")) ? await bookingVars(row.contact_id, now) : {};
    const params = rawParams.map((p) => p
      .replace(/\{\{first_name\}\}/g, contact.first_name || "there").replace(/\{\{last_name\}\}/g, contact.last_name || "")
      .replace(/\{\{email\}\}/g, contact.email || "").replace(/\{\{phone\}\}/g, contact.phone || "")
      .replace(/\{\{company_name\}\}/g, contact.company_name || "your company")
      .replace(/\{\{booking_date\}\}/g, bvars.booking_date ?? "").replace(/\{\{booking_time\}\}/g, bvars.booking_time ?? "")
      .replace(/\{\{booking_meet_link\}\}/g, bvars.booking_meet_link ?? "").replace(/\{\{booking_reschedule_link\}\}/g, bvars.booking_reschedule_link ?? "")
      .replace(/\{\{google_calendar_link\}\}/g, bvars.google_calendar_link ?? "").replace(/\{\{apple_calendar_link\}\}/g, bvars.apple_calendar_link ?? ""));
    const paramNames = (step.wa_template_param_names ?? []) as string[];
    if (opts.dryRun) { res.sent++; continue; }
    const r = await sendTemplate(contact.phone, step.wa_template_name, params, step.wa_template_language || "en", paramNames.length ? paramNames : undefined);
    const outcome = await markResult("wa_sends", row.id, r.success, row.attempts ?? 0, r.messageId ?? null, r.success ? null : (r.error ?? "wa_failed"));
    res[outcome as "sent" | "failed" | "dead"]++;
  }

  if (res.sent || res.failed || res.dead) await logger.info("journey-outbox", `drained: ${res.sent} sent, ${res.failed} retry, ${res.dead} dead, ${res.skipped} skipped`, { ...res });
  return res;
}
