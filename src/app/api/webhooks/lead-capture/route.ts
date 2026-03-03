import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { leadCaptureSchema } from "@/lib/validations";
import { formatPhone } from "@/lib/utils";

export async function POST(request: NextRequest) {
  // ── Step 1: Verify secret ──────────────────────────
  const secret = process.env.WEBHOOK_SECRET;
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

  const parsed = leadCaptureSchema.safeParse(rawBody);
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

  // ── Step 8: Return response ────────────────────────
  return NextResponse.json(
    { success: true, contact_id: contactId, is_duplicate: isDuplicate },
    { status: isDuplicate ? 200 : 201 }
  );
}
