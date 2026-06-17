import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AudienceFilter } from "@/types/campaigns";

/**
 * Enroll audience contacts into a WhatsApp drip campaign.
 * Used by both the enroll endpoint and the PATCH auto-enroll.
 */
export async function enrollAudience(
  campaignId: string,
  audienceFilter: AudienceFilter | null
): Promise<number> {
  // Build audience query
  let query = supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("type", "prospect")
    .eq("is_customer", false)
    .is("deleted_at", null)
    .not("phone", "is", null);

  if (!audienceFilter?.include_archived) {
    query = query.is("archived_at", null);
  }

  if (audienceFilter) {
    // Support both old single-value and new multi-value fields
    const sources = audienceFilter.sources?.length ? audienceFilter.sources : audienceFilter.source ? [audienceFilter.source] : [];
    const funnelIds = audienceFilter.funnel_ids?.length ? audienceFilter.funnel_ids : audienceFilter.funnel_id ? [audienceFilter.funnel_id] : [];
    const stageIds = audienceFilter.stage_ids?.length ? audienceFilter.stage_ids : audienceFilter.stage_id ? [audienceFilter.stage_id] : [];
    const assignedTos = audienceFilter.assigned_tos?.length ? audienceFilter.assigned_tos : audienceFilter.assigned_to ? [audienceFilter.assigned_to] : [];

    if (sources.length > 0) query = query.in("source", sources);
    if (funnelIds.length > 0) query = query.in("funnel_id", funnelIds);
    if (stageIds.length > 0) query = query.in("current_stage_id", stageIds);
    if (assignedTos.length > 0) query = query.in("assigned_to", assignedTos);
    if (audienceFilter.tags?.length) {
      query = query.overlaps("tags", audienceFilter.tags);
    }
    if (audienceFilter.created_after) query = query.gte("created_at", audienceFilter.created_after);
    if (audienceFilter.created_before) query = query.lte("created_at", audienceFilter.created_before + "T23:59:59.999Z");
  }

  const { data: contacts } = await query;
  if (!contacts?.length) return 0;

  // Filter out excluded contacts and already-enrolled contacts
  let contactIds = contacts.map((c) => c.id);
  if (audienceFilter?.excluded_contact_ids?.length) {
    const excludedSet = new Set(audienceFilter.excluded_contact_ids);
    contactIds = contactIds.filter((id) => !excludedSet.has(id));
  }
  const { data: existing } = await supabaseAdmin.from("drip_enrollments")
    .select("contact_id")
    .eq("campaign_id", campaignId)
    .in("contact_id", contactIds)
    .in("status", ["active", "paused"]);

  const alreadyEnrolled = new Set((existing ?? []).map((e) => e.contact_id));
  const toEnroll = contactIds.filter((id) => !alreadyEnrolled.has(id));

  if (!toEnroll.length) return 0;

  // Fetch the first step (order + id for branching support)
  const { data: firstStep } = await supabaseAdmin
    .from("wa_steps")
    .select("id, order")
    .eq("campaign_id", campaignId)
    .order("order", { ascending: true })
    .limit(1)
    .single();

  const firstOrder = firstStep?.order ?? 1;
  const firstStepId = firstStep?.id ?? null;
  const now = new Date().toISOString();

  // Bulk insert enrollments
  const rows = toEnroll.map((contactId) => ({
    contact_id: contactId,
    campaign_id: campaignId,
    campaign_type: "whatsapp" as const,
    current_step_order: firstOrder,
    current_step_id: firstStepId,
    status: "active" as const,
    next_send_at: now,
  }));

  const { error } = await supabaseAdmin.from("drip_enrollments")
    .insert(rows);

  if (error) {
    console.error("[Enroll] Bulk insert error:", error.message);
    return 0;
  }

  return toEnroll.length;
}
