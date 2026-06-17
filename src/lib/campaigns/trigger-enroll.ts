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
  const { data: contactGate } = await supabaseAdmin
    .from("contacts")
    .select("is_customer")
    .eq("id", contactId)
    .single();
  if (contactGate?.is_customer) return;

  // Find active unified campaigns matching this trigger
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaigns } = await (supabaseAdmin as any)
    .from("unified_campaigns")
    .select("id, trigger_event, audience_filter, engine")
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
      // Check if contact is manually excluded
      const excludedIds = filter.excluded_contact_ids as string[] | undefined;
      if (excludedIds?.includes(contactId)) continue;

      const { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("source, funnel_id, current_stage_id, assigned_to, archived_at")
        .eq("id", contactId)
        .single();

      if (!contact) continue;

      // Support both old single-value and new multi-value fields
      const sources = (filter.sources as string[])?.length ? (filter.sources as string[]) : filter.source ? [filter.source as string] : [];
      const funnelIds = (filter.funnel_ids as string[])?.length ? (filter.funnel_ids as string[]) : filter.funnel_id ? [filter.funnel_id as string] : [];
      const stageIds = (filter.stage_ids as string[])?.length ? (filter.stage_ids as string[]) : filter.stage_id ? [filter.stage_id as string] : [];
      const assignedTos = (filter.assigned_tos as string[])?.length ? (filter.assigned_tos as string[]) : filter.assigned_to ? [filter.assigned_to as string] : [];

      if (sources.length > 0 && !sources.includes(contact.source ?? "")) continue;
      if (funnelIds.length > 0 && !funnelIds.includes(contact.funnel_id ?? "")) continue;
      if (stageIds.length > 0 && !stageIds.includes(contact.current_stage_id ?? "")) continue;
      if (assignedTos.length > 0 && !assignedTos.includes(contact.assigned_to ?? "")) continue;
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

    // Enroll — inherit engine flag from the campaign so v2 campaigns get v2 enrollments
    await supabaseAdmin.from("drip_enrollments").insert({
      contact_id: contactId,
      campaign_id: campaign.id,
      campaign_type: "unified",
      current_step_order: firstStep.order,
      current_step_id: firstStep.id,
      status: "active",
      next_send_at: new Date().toISOString(),
      engine: (campaign as { engine?: string }).engine ?? "legacy",
    });
  }
}
