import { supabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import type { AudienceFilter } from "@/types/campaigns";

/**
 * Check if a contact matches a campaign's audience filter.
 */
async function contactMatchesFilter(
  contactId: string,
  filter: AudienceFilter | null
): Promise<boolean> {
  // No filter or custom-only means match all
  if (!filter) return true;
  if (filter.source === "__custom_only__") return false;

  const hasFilter =
    filter.source || filter.funnel_id || filter.stage_id ||
    filter.assigned_to || (filter.tags && filter.tags.length > 0);

  if (!hasFilter) return true;

  let query = supabaseAdmin
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("id", contactId)
    .is("deleted_at", null);

  if (!filter.include_archived) {
    query = query.is("archived_at", null);
  }

  if (filter.source) query = query.eq("source", filter.source);
  if (filter.funnel_id) query = query.eq("funnel_id", filter.funnel_id);
  if (filter.stage_id) query = query.eq("current_stage_id", filter.stage_id);
  if (filter.assigned_to) query = query.eq("assigned_to", filter.assigned_to);
  if (filter.tags?.length) query = query.overlaps("tags", filter.tags);

  const { count } = await query;
  return (count ?? 0) > 0;
}

/**
 * Auto-enroll a contact into all active drip campaigns
 * that have a "lead_created" trigger and whose audience filter matches.
 */
export async function autoEnrollIntoDrips(contactId: string) {
  const now = new Date().toISOString();

  // Find active WhatsApp drip campaigns with lead_created trigger
  const { data: waCampaigns } = await supabaseAdmin
    .from("wa_campaigns")
    .select("id, flow_data, audience_filter")
    .eq("type", "drip")
    .eq("status", "active");

  console.log(`[Auto-Enroll] Found ${waCampaigns?.length ?? 0} active WA drip campaigns for contact ${contactId}`);

  const waToEnroll: string[] = [];
  for (const c of waCampaigns ?? []) {
    const af = c.audience_filter as AudienceFilter | null;
    if (af?.enrollment_type === "existing") {
      console.log(`[Auto-Enroll] Skipping WA campaign ${c.id}: enrollment_type=existing`);
      continue;
    }

    const flow = c.flow_data as { nodes?: { data?: { event?: string; nodeType?: string } }[] } | null;
    const hasTrigger = flow?.nodes?.some(
      (n) => n.data?.nodeType === "trigger" && n.data?.event === "lead_created"
    );

    if (!hasTrigger) {
      console.log(`[Auto-Enroll] Skipping WA campaign ${c.id}: no lead_created trigger. Trigger nodes:`,
        flow?.nodes?.filter((n) => n.data?.nodeType === "trigger").map((n) => n.data));
      continue;
    }

    // Check audience filter match
    const matches = await contactMatchesFilter(contactId, af);
    if (!matches) {
      console.log(`[Auto-Enroll] Skipping WA campaign ${c.id}: contact doesn't match audience filter`);
      continue;
    }

    waToEnroll.push(c.id);
  }

  // Find active email drip campaigns with lead_created trigger
  const { data: emailCampaigns } = await supabaseAdmin
    .from("email_campaigns")
    .select("id, audience_filter")
    .eq("type", "drip")
    .eq("status", "active")
    .eq("trigger_event", "lead_created");

  // Filter by audience — only enroll if contact matches the campaign's filter
  // Skip campaigns with enrollment_type "existing"
  const emailToEnroll: string[] = [];
  for (const c of emailCampaigns ?? []) {
    const filter = c.audience_filter as AudienceFilter | null;
    if (filter?.enrollment_type === "existing") continue;
    const matches = await contactMatchesFilter(contactId, filter);
    if (matches) emailToEnroll.push(c.id);
  }

  // Find active unified drip campaigns with lead_created trigger
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: unifiedCampaigns } = await (supabaseAdmin as any)
    .from("unified_campaigns")
    .select("id, flow_data, audience_filter")
    .eq("type", "drip")
    .eq("status", "active");

  const unifiedToEnroll: string[] = [];
  for (const c of unifiedCampaigns ?? []) {
    const af = c.audience_filter as AudienceFilter | null;
    if (af?.enrollment_type === "existing") continue;
    const flow = c.flow_data as { nodes?: { data?: { event?: string; nodeType?: string } }[] } | null;
    const hasTrigger = flow?.nodes?.some(
      (n) => n.data?.nodeType === "trigger" && n.data?.event === "lead_created"
    );
    if (!hasTrigger) continue;
    const matches = await contactMatchesFilter(contactId, af);
    if (matches) unifiedToEnroll.push(c.id);
  }

  if (!waToEnroll.length && !emailToEnroll.length && !unifiedToEnroll.length) return;

  // Check existing enrollments to avoid duplicates
  const allCampaignIds = [...waToEnroll, ...emailToEnroll, ...unifiedToEnroll];
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
    campaign_type: "whatsapp" | "email" | "unified";
    current_step_order: number;
    current_step_id: string | null;
    status: "active";
    next_send_at: string;
  }[] = [];

  // Build WA enrollment rows
  for (const campaignId of waToEnroll) {
    if (alreadyEnrolled.has(campaignId)) continue;
    const { data: firstStep } = await supabaseAdmin
      .from("wa_steps")
      .select("id, order")
      .eq("campaign_id", campaignId)
      .order("order", { ascending: true })
      .limit(1)
      .maybeSingle();

    rows.push({
      contact_id: contactId,
      campaign_id: campaignId,
      campaign_type: "whatsapp",
      current_step_order: firstStep?.order ?? 1,
      current_step_id: firstStep?.id ?? null,
      status: "active",
      next_send_at: now,
    });
  }

  // Build email enrollment rows
  for (const campaignId of emailToEnroll) {
    if (alreadyEnrolled.has(campaignId)) continue;
    const { data: firstStep } = await supabaseAdmin
      .from("email_steps")
      .select("id, order")
      .eq("campaign_id", campaignId)
      .order("order", { ascending: true })
      .limit(1)
      .maybeSingle();

    rows.push({
      contact_id: contactId,
      campaign_id: campaignId,
      campaign_type: "email",
      current_step_order: firstStep?.order ?? 1,
      current_step_id: firstStep?.id ?? null,
      status: "active",
      next_send_at: now,
    });
  }

  // Build unified enrollment rows
  for (const campaignId of unifiedToEnroll) {
    if (alreadyEnrolled.has(campaignId)) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: firstStep } = await (supabaseAdmin as any)
      .from("unified_steps")
      .select("id, order")
      .eq("campaign_id", campaignId)
      .order("order", { ascending: true })
      .limit(1)
      .maybeSingle();

    rows.push({
      contact_id: contactId,
      campaign_id: campaignId,
      campaign_type: "unified",
      current_step_order: firstStep?.order ?? 1,
      current_step_id: firstStep?.id ?? null,
      status: "active",
      next_send_at: now,
    });
  }

  if (!rows.length) return;

  const { error } = await supabaseAdmin.from("drip_enrollments").insert(rows);
  if (error) {
    await logger.error("auto-enroll", `Enrollment insert error: ${error.message}`, { contact_id: contactId });
    return;
  }

  await logger.info("auto-enroll", `Enrolled contact ${contactId} into ${rows.length} drip(s)`, {
    contact_id: contactId,
    campaigns: rows.length,
  });
}
