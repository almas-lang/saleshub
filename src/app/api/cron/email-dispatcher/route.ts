import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, renderVariables } from "@/lib/email/client";
import { renderDripEmail } from "@/lib/email/templates/drip-wrapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_LIMIT = 50;
const CONCURRENCY = 10;

/**
 * Cron: Email Dispatcher
 *
 * Processes queued email_sends for one-time and newsletter campaigns.
 * Fetches the email step content, resolves contact variables,
 * sends via Resend, and updates status.
 */
export async function GET(request: NextRequest) {
  // Auth check (header or query param)
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret");
  const isAuthed =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch queued sends (oldest first)
  const { data: queuedSends, error: fetchError } = await supabaseAdmin
    .from("email_sends")
    .select("id, campaign_id, step_id, contact_id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (fetchError) {
    console.error("[Email Dispatcher] Fetch error:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!queuedSends?.length) {
    return NextResponse.json({ processed: 0, message: "No queued sends" });
  }

  // Gather unique step IDs and contact IDs to batch-fetch
  const stepIds = [...new Set(queuedSends.map((s) => s.step_id).filter(Boolean))] as string[];
  const contactIds = [...new Set(queuedSends.map((s) => s.contact_id))];

  // Fetch steps and contacts in parallel
  const [{ data: steps }, { data: contacts }] = await Promise.all([
    supabaseAdmin
      .from("email_steps")
      .select("id, subject, body_html")
      .in("id", stepIds),
    supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, email, company_name")
      .in("id", contactIds),
  ]);

  const stepMap = new Map<string, { subject: string; body_html: string }>();
  for (const step of steps ?? []) {
    stepMap.set(step.id, { subject: step.subject, body_html: step.body_html });
  }

  const contactMap = new Map<string, {
    email: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  }>();
  for (const c of contacts ?? []) {
    if (c.email) {
      contactMap.set(c.id, {
        email: c.email,
        first_name: c.first_name,
        last_name: c.last_name,
        company_name: c.company_name,
      });
    }
  }

  // Pre-render the wrapper HTML once per step (template is the same,
  // only the variable-substituted body differs per contact — but the
  // wrapper chrome is identical). We render with a placeholder and
  // swap the body per-contact via string replace, avoiding 50 React renders.
  const BODY_PLACEHOLDER = "<!--__BODY_PLACEHOLDER__-->";
  const renderedWrapperCache = new Map<string, { wrapperHtml: string }>();
  for (const [stepId, step] of stepMap) {
    const { html } = await renderDripEmail({
      subject: step.subject,
      bodyHtml: BODY_PLACEHOLDER,
    });
    renderedWrapperCache.set(stepId, { wrapperHtml: html });
  }

  let sent = 0;
  let failed = 0;

  // Process a single send
  async function processSend(send: { id: string; campaign_id: string | null; step_id: string | null; contact_id: string }) {
    const step = send.step_id ? stepMap.get(send.step_id) : null;
    const contact = contactMap.get(send.contact_id);
    const wrapper = send.step_id ? renderedWrapperCache.get(send.step_id) : null;

    if (!step || !contact || !wrapper) {
      await supabaseAdmin
        .from("email_sends")
        .update({ status: "failed" })
        .eq("id", send.id);
      return false;
    }

    // Render variables in subject and body
    const vars: Record<string, string> = {
      first_name: contact.first_name ?? "",
      last_name: contact.last_name ?? "",
      full_name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
      email: contact.email,
      company_name: contact.company_name ?? "",
    };

    const subject = renderVariables(step.subject, vars);
    const bodyHtml = renderVariables(step.body_html, vars);

    // Swap placeholder with the contact's rendered body (no React render needed)
    const html = wrapper.wrapperHtml.replace(BODY_PLACEHOLDER, bodyHtml);

    const result = await sendEmail({
      to: contact.email,
      subject,
      html,
      tags: [
        { name: "campaign_id", value: send.campaign_id ?? "unknown" },
        { name: "send_id", value: send.id },
      ],
    });

    if (result.success) {
      await Promise.all([
        supabaseAdmin
          .from("email_sends")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            resend_message_id: result.messageId ?? null,
          })
          .eq("id", send.id),
        supabaseAdmin.from("activities").insert({
          contact_id: send.contact_id,
          type: "email_sent",
          title: `Campaign email sent: ${subject}`,
        }),
      ]);
      return true;
    } else {
      await supabaseAdmin
        .from("email_sends")
        .update({ status: "failed" })
        .eq("id", send.id);
      console.error(`[Email Dispatcher] Failed send ${send.id}:`, result.error);
      return false;
    }
  }

  // Process in parallel chunks of CONCURRENCY
  for (let i = 0; i < queuedSends.length; i += CONCURRENCY) {
    const chunk = queuedSends.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(processSend));
    for (const ok of results) {
      if (ok) sent++;
      else failed++;
    }
  }

  // Mark campaign as completed if all sends are done
  const campaignIds = [...new Set(queuedSends.map((s) => s.campaign_id).filter(Boolean))];
  for (const campaignId of campaignIds) {
    const { count } = await supabaseAdmin
      .from("email_sends")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId!)
      .eq("status", "queued");

    if (count === 0) {
      await supabaseAdmin
        .from("email_campaigns")
        .update({ status: "completed" })
        .eq("id", campaignId!)
        .in("type", ["one_time", "newsletter"]);
    }
  }

  return NextResponse.json({ processed: queuedSends.length, sent, failed });
}
