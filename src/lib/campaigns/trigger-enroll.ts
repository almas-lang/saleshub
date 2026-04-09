import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Check active unified campaigns for a matching trigger_event and enroll the contact.
 * Called from booking status changes, stage changes, etc.
 */
export async function enrollContactByTrigger(
  contactId: string,
  triggerEvent: string,
  _triggerStageId?: string
): Promise<void> {
  // Find active unified campaigns matching this trigger
  const { data: campaigns } = await supabaseAdmin
    .from("unified_campaigns")
    .select("id, trigger_event, audience_filter")
    .eq("status", "active")
    .eq("trigger_event", triggerEvent);
  if (!campaigns?.length) return;

  // For stage_changed triggers, filter by trigger stage_id stored in flow_data
  // (trigger_stage_id isn't a separate column yet, but we stored it in flow_data)

  for (const campaign of campaigns) {
    // Check if contact already enrolled in this campaign
    const { count } = await supabaseAdmin
      .from("drip_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contactId)
      .eq("campaign_id", campaign.id)
      .eq("campaign_type", "unified");

    if ((count ?? 0) > 0) continue; // Already enrolled

    // Check audience filter match
    const filter = campaign.audience_filter as Record<string, unknown> | null;
    if (filter) {
      const { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("source, funnel_id, current_stage_id, assigned_to, archived_at")
        .eq("id", contactId)
        .single();

      if (!contact) continue;
      if (filter.source && contact.source !== filter.source) continue;
      if (filter.funnel_id && contact.funnel_id !== filter.funnel_id) continue;
      if (filter.stage_id && contact.current_stage_id !== filter.stage_id) continue;
      if (filter.assigned_to && contact.assigned_to !== filter.assigned_to) continue;
      if (!filter.include_archived && contact.archived_at) continue;
    }

    // Get first step
    const { data: steps } = await supabaseAdmin
      .from("unified_steps")
      .select("id, order")
      .eq("campaign_id", campaign.id)
      .order("order", { ascending: true })
      .limit(1);

    const firstStep = steps?.[0];
    if (!firstStep) continue;

    // Enroll
    await supabaseAdmin.from("drip_enrollments").insert({
      contact_id: contactId,
      campaign_id: campaign.id,
      campaign_type: "unified",
      current_step_order: firstStep.order,
      current_step_id: firstStep.id,
      status: "active",
      next_send_at: new Date().toISOString(),
    });
  }
}
