import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Auto-enroll a contact into all active drip campaigns
 * that have a "lead_created" trigger.
 */
export async function autoEnrollIntoDrips(contactId: string) {
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
    console.error("[Auto-Enroll] Drip enrollment insert error:", error.message);
    return;
  }

  console.log(`[Auto-Enroll] Enrolled contact ${contactId} into ${rows.length} drip(s)`);
}
