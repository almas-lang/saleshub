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
    .is("deleted_at", null)
    .not("phone", "is", null);

  if (!audienceFilter?.include_archived) {
    query = query.is("archived_at", null);
  }

  if (audienceFilter) {
    if (audienceFilter.source) query = query.eq("source", audienceFilter.source);
    if (audienceFilter.funnel_id) query = query.eq("funnel_id", audienceFilter.funnel_id);
    if (audienceFilter.stage_id) query = query.eq("current_stage_id", audienceFilter.stage_id);
    if (audienceFilter.assigned_to) query = query.eq("assigned_to", audienceFilter.assigned_to);
    if (audienceFilter.tags?.length) {
      query = query.overlaps("tags", audienceFilter.tags);
    }
  }

  const { data: contacts } = await query;
  if (!contacts?.length) return 0;

  // Filter out already-enrolled contacts for this campaign
  const contactIds = contacts.map((c) => c.id);
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
