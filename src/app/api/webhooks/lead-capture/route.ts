import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { leadCaptureSchema } from "@/lib/validations";
import { formatPhone } from "@/lib/utils";
import { sendEmail } from "@/lib/email/client";
import { renderWelcomeEmail } from "@/lib/email/templates/welcome";

/** Map variant field names (PascalCase, Title Case, etc.) to snake_case schema keys */
const FIELD_ALIASES: Record<string, string> = {
  CallBooked: "call_booked",
  "Call Booked": "call_booked",
  "call booked": "call_booked",
  "Booked At": "booked_at",
  BookedAt: "booked_at",
  "Work Experience": "work_experience",
  WorkExperience: "work_experience",
  "Current Role": "current_role",
  CurrentRole: "current_role",
  "Key Challenge": "key_challenge",
  KeyChallenge: "key_challenge",
  "Desired Salary": "desired_salary",
  DesiredSalary: "desired_salary",
  Blocker: "blocker",
  "Financial Readiness": "financial_readiness",
  FinancialReadiness: "financial_readiness",
  Urgency: "urgency",
  "LinkedIn URL": "linkedin_url",
  LinkedinUrl: "linkedin_url",
  linkedin_url: "linkedin_url",
};

function normalizeFieldNames(
  body: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    const mappedKey = FIELD_ALIASES[key] ?? key;
    // Don't overwrite if the canonical key is already present
    if (!(mappedKey in normalized)) {
      normalized[mappedKey] = value;
    }
  }
  return normalized;
}

export async function POST(request: NextRequest) {
  // ── Step 1: Verify secret ──────────────────────────
  const secret = process.env.SALESHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  const headerSecret = request.headers.get("x-webhook-secret");
  const querySecret = request.nextUrl.searchParams.get("key");

  if (headerSecret !== secret && querySecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Step 2: Parse body ─────────────────────────────
  let rawBody: Record<string, unknown>;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    rawBody = Object.fromEntries(formData.entries());
  } else {
    rawBody = await request.json();
  }

  // Normalize variant field names to snake_case before validation
  const normalizedBody = normalizeFieldNames(rawBody);

  const parsed = leadCaptureSchema.safeParse(normalizedBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const lead = parsed.data;

  // ── Step 3: Normalize data ─────────────────────────
  const nameParts = lead.name.trim().split(/\s+/);
  const first_name = nameParts[0];
  const last_name = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

  const email = lead.email.toLowerCase().trim();
  const phone = lead.phone ? formatPhone(lead.phone) : null;
  const source = lead.source ?? "landing_page";

  const utmData = {
    utm_source: lead.utm_source ?? null,
    utm_medium: lead.utm_medium ?? null,
    utm_campaign: lead.utm_campaign ?? null,
    utm_content: lead.utm_content ?? null,
    utm_term: lead.utm_term ?? null,
  };

  // ── Step 4: Deduplication ──────────────────────────
  let existingContact: { id: string; phone: string | null; funnel_id: string | null } | null = null;

  // Check by email first
  const { data: byEmail } = await supabaseAdmin
    .from("contacts")
    .select("id, phone, funnel_id")
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle();

  existingContact = byEmail;

  // If no email match and phone provided, check by phone
  if (!existingContact && phone) {
    const { data: byPhone } = await supabaseAdmin
      .from("contacts")
      .select("id, phone, funnel_id")
      .eq("phone", phone)
      .is("deleted_at", null)
      .maybeSingle();

    existingContact = byPhone;
  }

  const isDuplicate = !!existingContact;

  // ── Step 5: Find default funnel ────────────────────
  let funnelId: string | null = null;
  let firstStageId: string | null = null;

  const { data: defaultFunnel } = await supabaseAdmin
    .from("funnels")
    .select("id")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();

  if (defaultFunnel) {
    funnelId = defaultFunnel.id;

    const { data: firstStage } = await supabaseAdmin
      .from("funnel_stages")
      .select("id")
      .eq("funnel_id", defaultFunnel.id)
      .order("order", { ascending: true })
      .limit(1)
      .maybeSingle();

    firstStageId = firstStage?.id ?? null;
  }

  // ── Step 6: Create or update contact ───────────────
  let contactId: string;

  if (existingContact) {
    // Update: refresh UTMs, fill missing phone, assign funnel if unset
    const updates: Record<string, unknown> = { ...utmData };

    if (!existingContact.phone && phone) {
      updates.phone = phone;
    }

    if (!existingContact.funnel_id && funnelId) {
      updates.funnel_id = funnelId;
      updates.current_stage_id = firstStageId;
    }

    await supabaseAdmin
      .from("contacts")
      .update(updates)
      .eq("id", existingContact.id);

    contactId = existingContact.id;
  } else {
    // New contact
    const { data: newContact, error: insertError } = await supabaseAdmin
      .from("contacts")
      .insert({
        first_name,
        last_name,
        email,
        phone,
        source,
        type: "prospect",
        tags: ["landing-page"],
        funnel_id: funnelId,
        current_stage_id: firstStageId,
        ...utmData,
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    contactId = newContact.id;
  }

  // ── Step 7: Log activity ───────────────────────────
  await supabaseAdmin.from("activities").insert({
    contact_id: contactId,
    type: "form_submitted",
    title: `New lead captured from ${source}`,
    metadata: {
      ...utmData,
      is_duplicate: isDuplicate,
      source,
    },
  });

  // ── Step 7.5: Send welcome email (new contacts only) ─
  if (!isDuplicate) {
    try {
      const { subject, html } = await renderWelcomeEmail({
        firstName: first_name,
      });
      const welcomeResult = await sendEmail({ to: email, subject, html });
      await supabaseAdmin.from("activities").insert({
        contact_id: contactId,
        type: "email_sent",
        title: "Welcome email sent",
        metadata: { template: "welcome" },
      });
      if (welcomeResult.success) {
        await supabaseAdmin.from("email_sends").insert({
          contact_id: contactId,
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_message_id: welcomeResult.messageId ?? null,
        });
      }
    } catch (emailErr) {
      console.error("[Lead Capture] Welcome email failed:", emailErr);
    }
  }

  // ── Step 8: Process booking (if call was booked) ───
  const isBooked = ["yes", "true", "1"].includes(
    (lead.call_booked ?? "").toLowerCase().trim()
  );

  if (isBooked && funnelId) {
    const bookedAt = lead.booked_at ?? new Date().toISOString();

    // 8a. Find "121 Booked" stage in the contact's funnel
    const contactFunnelId = existingContact?.funnel_id ?? funnelId;
    const { data: bookedStage } = await supabaseAdmin
      .from("funnel_stages")
      .select("id")
      .eq("funnel_id", contactFunnelId)
      .eq("name", "121 Booked")
      .maybeSingle();

    if (bookedStage) {
      // 8b. Move contact to "121 Booked" stage + set metadata.call_booked
      const { data: currentContact } = await supabaseAdmin
        .from("contacts")
        .select("metadata")
        .eq("id", contactId)
        .single();

      const existingMeta = (currentContact?.metadata as Record<string, unknown>) ?? {};

      const stageUpdate: Record<string, unknown> = {
        current_stage_id: bookedStage.id,
        metadata: { ...existingMeta, call_booked: "yes", booked_at: bookedAt },
      };
      if (lead.linkedin_url) {
        stageUpdate.linkedin_url = lead.linkedin_url;
      }
      await supabaseAdmin
        .from("contacts")
        .update(stageUpdate)
        .eq("id", contactId);

      // 8c. Insert form response (with enum validation)
      const VALID_WORK_EXPERIENCE = ["fresher", "<2_years", "3-5_years", "5-10_years", "10+_years"] as const;
      const VALID_FINANCIAL_READINESS = ["ready", "careful_but_open", "not_ready"] as const;
      const VALID_URGENCY = ["right_now", "within_90_days", "more_than_90_days"] as const;

      type WorkExp = (typeof VALID_WORK_EXPERIENCE)[number];
      type FinReady = (typeof VALID_FINANCIAL_READINESS)[number];
      type Urg = (typeof VALID_URGENCY)[number];

      await supabaseAdmin
        .from("contact_form_responses")
        .insert({
          contact_id: contactId,
          form_email: email,
          created_at: bookedAt,
          work_experience: lead.work_experience && (VALID_WORK_EXPERIENCE as readonly string[]).includes(lead.work_experience)
            ? (lead.work_experience as WorkExp)
            : null,
          current_role: lead.current_role ?? null,
          key_challenge: lead.key_challenge ?? null,
          desired_salary: lead.desired_salary ?? null,
          blocker: lead.blocker ?? null,
          financial_readiness: lead.financial_readiness && (VALID_FINANCIAL_READINESS as readonly string[]).includes(lead.financial_readiness)
            ? (lead.financial_readiness as FinReady)
            : null,
          urgency: lead.urgency && (VALID_URGENCY as readonly string[]).includes(lead.urgency)
            ? (lead.urgency as Urg)
            : null,
        });

      // 8d. Log booking activity
      await supabaseAdmin.from("activities").insert({
        contact_id: contactId,
        type: "booking_created",
        title: "Call booked via landing page",
        created_at: bookedAt,
        metadata: { source, booked_at: bookedAt },
      });
    }
  }

  // ── Step 9: Auto-enroll into active drip sequences ─
  if (!isDuplicate) {
    try {
      await autoEnrollIntoDrips(contactId);
    } catch (err) {
      console.error("[Lead Capture] Drip auto-enroll error:", err);
    }
  }

  // ── Step 10: Return response ────────────────────────
  return NextResponse.json(
    {
      success: true,
      contact_id: contactId,
      is_duplicate: isDuplicate,
      booking_processed: isBooked,
    },
    { status: isDuplicate ? 200 : 201 }
  );
}

// ── Auto-enroll into active drip campaigns ────────────

async function autoEnrollIntoDrips(contactId: string) {
  const now = new Date().toISOString();

  // Find active WhatsApp drip campaigns with lead_created trigger
  const { data: waCampaigns } = await supabaseAdmin
    .from("wa_campaigns")
    .select("id, flow_data")
    .eq("type", "drip")
    .eq("status", "active");

  const waToEnroll: string[] = [];
  for (const c of waCampaigns ?? []) {
    const flow = c.flow_data as { nodes?: { data?: { event?: string; nodeType?: string } }[] } | null;
    const hasTrigger = flow?.nodes?.some(
      (n) => n.data?.nodeType === "trigger" && n.data?.event === "lead_created"
    );
    if (hasTrigger) waToEnroll.push(c.id);
  }

  // Find active email drip campaigns with lead_created trigger
  const { data: emailCampaigns } = await supabaseAdmin
    .from("email_campaigns")
    .select("id")
    .eq("type", "drip")
    .eq("status", "active")
    .eq("trigger_event", "lead_created");

  const emailToEnroll: string[] = (emailCampaigns ?? []).map((c) => c.id);

  if (!waToEnroll.length && !emailToEnroll.length) return;

  // Check existing enrollments to avoid duplicates
  const allCampaignIds = [...waToEnroll, ...emailToEnroll];
  const { data: existing } = await supabaseAdmin
    .from("drip_enrollments")
    .select("campaign_id")
    .eq("contact_id", contactId)
    .in("campaign_id", allCampaignIds)
    .in("status", ["active", "paused"]);

  const alreadyEnrolled = new Set((existing ?? []).map((e) => e.campaign_id));

  const rows: {
    contact_id: string;
    campaign_id: string;
    campaign_type: "whatsapp" | "email";
    current_step_order: number;
    status: "active";
    next_send_at: string;
  }[] = [];

  // Build WA enrollment rows
  for (const campaignId of waToEnroll) {
    if (alreadyEnrolled.has(campaignId)) continue;
    const { data: firstStep } = await supabaseAdmin
      .from("wa_steps")
      .select("order")
      .eq("campaign_id", campaignId)
      .order("order", { ascending: true })
      .limit(1)
      .maybeSingle();

    rows.push({
      contact_id: contactId,
      campaign_id: campaignId,
      campaign_type: "whatsapp",
      current_step_order: firstStep?.order ?? 1,
      status: "active",
      next_send_at: now,
    });
  }

  // Build email enrollment rows
  for (const campaignId of emailToEnroll) {
    if (alreadyEnrolled.has(campaignId)) continue;
    const { data: firstStep } = await supabaseAdmin
      .from("email_steps")
      .select("order")
      .eq("campaign_id", campaignId)
      .order("order", { ascending: true })
      .limit(1)
      .maybeSingle();

    rows.push({
      contact_id: contactId,
      campaign_id: campaignId,
      campaign_type: "email",
      current_step_order: firstStep?.order ?? 1,
      status: "active",
      next_send_at: now,
    });
  }

  if (!rows.length) return;

  const { error } = await supabaseAdmin.from("drip_enrollments").insert(rows);
  if (error) {
    console.error("[Lead Capture] Drip enrollment insert error:", error.message);
    return;
  }

  console.log(`[Lead Capture] Auto-enrolled contact ${contactId} into ${rows.length} drip(s)`);
}
