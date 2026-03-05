import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatPhone } from "@/lib/utils";
import {
  normalizeWorkExperience,
  normalizeFinancialReadiness,
  normalizeUrgency,
} from "@/lib/import-utils";
import { sendEmail } from "@/lib/email/client";
import { renderBookingConfirmationEmail } from "@/lib/email/templates/booking-confirmation";
import { renderBookingReminderEmail } from "@/lib/email/templates/booking-reminder";
import { format } from "date-fns";

// ──────────────────────────────────────────
// Question → field mapping (matches FORM_RESPONSE_SYNONYM_MAP patterns)
// ──────────────────────────────────────────

type FormField =
  | "work_experience"
  | "current_role"
  | "key_challenge"
  | "desired_salary"
  | "blocker"
  | "financial_readiness"
  | "urgency"
  | "linkedin_url";

/** Map a Calendly question string to a contact_form_responses field. */
function matchQuestion(question: string): FormField | null {
  const q = question
    .toLowerCase()
    .trim()
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/\s+/g, " ");

  // linkedin
  if (q.includes("linkedin")) return "linkedin_url";

  // work experience
  if (
    q.includes("work experience") ||
    q.includes("total work experience") ||
    q.includes("years of experience")
  )
    return "work_experience";

  // current role
  if (
    q.includes("current role") ||
    q.includes("next role") ||
    q.includes("desired role") ||
    q.includes("designation")
  )
    return "current_role";

  // key challenge
  if (q.includes("challenge") || q.includes("challenges"))
    return "key_challenge";

  // desired salary
  if (q.includes("salary")) return "desired_salary";

  // blocker
  if (
    q.includes("stopping you") ||
    q.includes("100% honest") ||
    q.includes("holding you")
  )
    return "blocker";

  // financial readiness
  if (
    q.includes("financial") &&
    (q.includes("situation") ||
      q.includes("readiness") ||
      q.includes("invest") ||
      q.includes("growth"))
  )
    return "financial_readiness";

  // urgency
  if (
    q.includes("how soon") ||
    (q.includes("ready") && q.includes("start")) ||
    q.includes("urgency") ||
    q.includes("timeline")
  )
    return "urgency";

  return null;
}

// ──────────────────────────────────────────
// Signature verification
// ──────────────────────────────────────────

function verifySignature(
  rawBody: string,
  signatureHeader: string,
  signingKey: string
): boolean {
  // Header format: t=<timestamp>,v1=<signature>
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const [key, ...rest] = part.split("=");
    parts[key.trim()] = rest.join("=");
  }

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", signingKey)
    .update(payload)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────
// Enum validators (same sets as lead-capture)
// ──────────────────────────────────────────

const VALID_WORK_EXPERIENCE = [
  "fresher",
  "<2_years",
  "3-5_years",
  "5-10_years",
  "10+_years",
] as const;
const VALID_FINANCIAL_READINESS = [
  "ready",
  "careful_but_open",
  "not_ready",
] as const;
const VALID_URGENCY = [
  "right_now",
  "within_90_days",
  "more_than_90_days",
] as const;

type WorkExp = (typeof VALID_WORK_EXPERIENCE)[number];
type FinReady = (typeof VALID_FINANCIAL_READINESS)[number];
type Urg = (typeof VALID_URGENCY)[number];

// ──────────────────────────────────────────
// POST handler
// ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Step 1: Verify webhook signature ─────────────
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    console.error("[Calendly Webhook] CALENDLY_WEBHOOK_SIGNING_KEY not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  const signatureHeader =
    request.headers.get("Calendly-Webhook-Signature") ?? "";

  if (!verifySignature(rawBody, signatureHeader, signingKey)) {
    console.warn("[Calendly Webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ── Step 2: Parse event ──────────────────────────
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event as string | undefined;

  // Only process invitee.created — acknowledge everything else
  if (event !== "invitee.created") {
    return NextResponse.json({ ok: true });
  }

  const payload = body.payload as Record<string, unknown> | undefined;
  if (!payload) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  // ── Step 3: Extract invitee data ─────────────────
  const email = (
    (payload.email as string) || ""
  ).toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const inviteeName =
    (payload.name as string) ||
    [payload.first_name, payload.last_name].filter(Boolean).join(" ") ||
    "";
  const nameParts = inviteeName.trim().split(/\s+/);
  const firstName = nameParts[0] || null;
  const lastName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

  // Phone: text_reminder_number field
  const rawPhone = (payload.text_reminder_number as string) ?? "";
  const phone = rawPhone ? formatPhone(rawPhone) : null;

  // Booked at: from the scheduled event start time
  const scheduledEvent = payload.scheduled_event as
    | Record<string, unknown>
    | undefined;
  const bookedAt =
    (scheduledEvent?.start_time as string) ?? new Date().toISOString();

  // ── Step 4: Map questions_and_answers ────────────
  const questionsAndAnswers = (payload.questions_and_answers ??
    []) as Array<{ question: string; answer: string }>;

  const formFields: Partial<Record<FormField, string>> = {};
  for (const qa of questionsAndAnswers) {
    const field = matchQuestion(qa.question);
    if (field && qa.answer) {
      formFields[field] = qa.answer.trim();
    }
  }

  // Normalize enum fields
  if (formFields.work_experience) {
    formFields.work_experience = normalizeWorkExperience(
      formFields.work_experience
    );
  }
  if (formFields.financial_readiness) {
    formFields.financial_readiness = normalizeFinancialReadiness(
      formFields.financial_readiness
    );
  }
  if (formFields.urgency) {
    formFields.urgency = normalizeUrgency(formFields.urgency);
  }

  // ── Step 5: Find or create contact ───────────────
  const { data: existingContact } = await supabaseAdmin
    .from("contacts")
    .select("id, funnel_id, current_stage_id, metadata, linkedin_url")
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle();

  let contactId: string;
  let contactFunnelId: string | null;

  if (existingContact) {
    contactId = existingContact.id;
    contactFunnelId = existingContact.funnel_id;
  } else {
    // Get default funnel + first stage for new contact
    const { data: defaultFunnel } = await supabaseAdmin
      .from("funnels")
      .select("id")
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();

    const funnelId = defaultFunnel?.id ?? null;
    let firstStageId: string | null = null;

    if (funnelId) {
      const { data: firstStage } = await supabaseAdmin
        .from("funnel_stages")
        .select("id")
        .eq("funnel_id", funnelId)
        .order("order", { ascending: true })
        .limit(1)
        .maybeSingle();

      firstStageId = firstStage?.id ?? null;
    }

    const { data: newContact, error: insertError } = await supabaseAdmin
      .from("contacts")
      .insert({
        first_name: firstName || "Unknown",
        last_name: lastName,
        email,
        phone,
        source: "calendly",
        type: "prospect",
        tags: ["calendly"],
        funnel_id: funnelId,
        current_stage_id: firstStageId,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[Calendly Webhook] Insert error:", insertError.message);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    contactId = newContact.id;
    contactFunnelId = funnelId;
  }

  // ── Step 6: Move contact to "121 Booked" stage ──
  if (contactFunnelId) {
    const { data: bookedStage } = await supabaseAdmin
      .from("funnel_stages")
      .select("id")
      .eq("funnel_id", contactFunnelId)
      .eq("name", "121 Booked")
      .maybeSingle();

    if (bookedStage) {
      const { data: currentContact } = await supabaseAdmin
        .from("contacts")
        .select("metadata, linkedin_url")
        .eq("id", contactId)
        .single();

      const existingMeta =
        (currentContact?.metadata as Record<string, unknown>) ?? {};

      const stageUpdate: Record<string, unknown> = {
        current_stage_id: bookedStage.id,
        metadata: {
          ...existingMeta,
          call_booked: "yes",
          booked_at: bookedAt,
        },
      };

      // Fill linkedin_url if provided and missing
      if (
        formFields.linkedin_url &&
        !currentContact?.linkedin_url
      ) {
        stageUpdate.linkedin_url = formFields.linkedin_url;
      }

      // Fill phone if missing on existing contact
      if (phone && existingContact) {
        const { data: phoneCheck } = await supabaseAdmin
          .from("contacts")
          .select("phone")
          .eq("id", contactId)
          .single();
        if (!phoneCheck?.phone) {
          stageUpdate.phone = phone;
        }
      }

      await supabaseAdmin
        .from("contacts")
        .update(stageUpdate)
        .eq("id", contactId);
    }
  }

  // ── Step 6.5: Create a bookings row ──────────────
  const startTime = scheduledEvent?.start_time as string | undefined;
  const endTime = scheduledEvent?.end_time as string | undefined;
  const location = scheduledEvent?.location as Record<string, unknown> | undefined;
  const meetLink = (location?.join_url as string) ?? null;
  const eventMemberships = (scheduledEvent?.event_memberships ?? []) as Array<{ user_name?: string }>;
  const hostName = eventMemberships[0]?.user_name ?? "Shaik Murad";

  if (startTime && endTime) {
    await supabaseAdmin.from("bookings").insert({
      contact_id: contactId,
      starts_at: startTime,
      ends_at: endTime,
      meet_link: meetLink,
      status: "confirmed",
    });
  }

  // ── Step 7: Insert contact_form_responses ────────
  await supabaseAdmin.from("contact_form_responses").insert({
    contact_id: contactId,
    form_email: email,
    created_at: bookedAt,
    work_experience:
      formFields.work_experience &&
      (VALID_WORK_EXPERIENCE as readonly string[]).includes(
        formFields.work_experience
      )
        ? (formFields.work_experience as WorkExp)
        : null,
    current_role: formFields.current_role ?? null,
    key_challenge: formFields.key_challenge ?? null,
    desired_salary: formFields.desired_salary ?? null,
    blocker: formFields.blocker ?? null,
    financial_readiness:
      formFields.financial_readiness &&
      (VALID_FINANCIAL_READINESS as readonly string[]).includes(
        formFields.financial_readiness
      )
        ? (formFields.financial_readiness as FinReady)
        : null,
    urgency:
      formFields.urgency &&
      (VALID_URGENCY as readonly string[]).includes(formFields.urgency)
        ? (formFields.urgency as Urg)
        : null,
  });

  // ── Step 8: Log booking activity ─────────────────
  await supabaseAdmin.from("activities").insert({
    contact_id: contactId,
    type: "booking_created",
    title: "Call booked via Calendly",
    metadata: { source: "calendly", booked_at: bookedAt },
  });

  // ── Step 8.5: Send booking confirmation email ────
  try {
    const { subject, html } = await renderBookingConfirmationEmail({
      firstName: firstName || "there",
    });
    await sendEmail({ to: email, subject, html });
    await supabaseAdmin.from("activities").insert({
      contact_id: contactId,
      type: "email_sent",
      title: "Booking confirmation email sent",
      metadata: { template: "booking-confirmation" },
    });
  } catch (emailErr) {
    console.error("[Calendly Webhook] Confirmation email failed:", emailErr);
  }

  // ── Step 8.6: Send booking reminder email (TEST — remove after testing) ──
  try {
    const startsAt = startTime ? new Date(startTime) : new Date();
    const { subject: remSubject, html: remHtml } = await renderBookingReminderEmail({
      firstName: firstName || "there",
      date: format(startsAt, "MMMM d, yyyy"),
      time: format(startsAt, "h:mm a"),
      hostName,
      meetLink: meetLink || "#",
    });
    await sendEmail({ to: email, subject: remSubject, html: remHtml });
    await supabaseAdmin.from("activities").insert({
      contact_id: contactId,
      type: "email_sent",
      title: "Booking reminder email sent (TEST)",
      metadata: { template: "booking-reminder" },
    });
  } catch (emailErr) {
    console.error("[Calendly Webhook] Reminder email failed:", emailErr);
  }

  // ── Step 9: Return 200 ──────────────────────────
  console.log(
    `[Calendly Webhook] Processed booking for ${email} (contact: ${contactId})`
  );
  return NextResponse.json({
    success: true,
    contact_id: contactId,
  });
}
