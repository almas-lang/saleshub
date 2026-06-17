import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AudienceFilter } from "@/types/campaigns";

/**
 * Resolve extra_emails to contact IDs.
 * Finds existing contacts by email; creates new ones for unknown addresses.
 */
async function resolveExtraEmails(emails: string[]): Promise<string[]> {
  if (!emails.length) return [];

  const unique = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean))];

  // Find existing contacts by email
  const { data: existing } = await supabaseAdmin
    .from("contacts")
    .select("id, email")
    .in("email", unique)
    .is("deleted_at", null);

  const found = new Map<string, string>();
  for (const c of existing ?? []) {
    if (c.email) found.set(c.email.toLowerCase(), c.id);
  }

  // Create contacts for unknown emails
  const toCreate = unique.filter((e) => !found.has(e));
  if (toCreate.length > 0) {
    const rows = toCreate.map((email) => ({
      first_name: email.split("@")[0],
      email,
      type: "prospect" as const,
      source: "campaign_extra",
    }));
    const { data: created } = await supabaseAdmin
      .from("contacts")
      .insert(rows)
      .select("id, email");
    for (const c of created ?? []) {
      if (c.email) found.set(c.email.toLowerCase(), c.id);
    }
  }

  return unique.map((e) => found.get(e)).filter((id): id is string => !!id);
}

/**
 * Get all audience contact IDs for an email campaign,
 * including both filter-matched contacts and extra_emails recipients.
 */
export async function getEmailAudienceContactIds(
  audienceFilter: AudienceFilter | null
): Promise<string[]> {
  const contactIds: string[] = [];
  const isCustomOnly = audienceFilter?.source === "__custom_only__";

  // 1. Filter-matched contacts (skip when "custom emails only")
  if (!isCustomOnly) {
    let query = supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("type", "prospect")
      .eq("is_customer", false)
      .is("deleted_at", null)
      .not("email", "is", null);

    if (!audienceFilter?.include_archived) {
      query = query.is("archived_at", null);
    }

    if (audienceFilter) {
      // Support both old single-value and new multi-value fields
      const sources = audienceFilter.sources?.length ? audienceFilter.sources : audienceFilter.source ? [audienceFilter.source] : [];
      const funnelIds = audienceFilter.funnel_ids?.length ? audienceFilter.funnel_ids : audienceFilter.funnel_id ? [audienceFilter.funnel_id] : [];
      const stageIds = audienceFilter.stage_ids?.length ? audienceFilter.stage_ids : audienceFilter.stage_id ? [audienceFilter.stage_id] : [];
      const assignedTos = audienceFilter.assigned_tos?.length ? audienceFilter.assigned_tos : audienceFilter.assigned_to ? [audienceFilter.assigned_to] : [];

      if (sources.length > 0 && sources[0] !== "__custom_only__") query = query.in("source", sources);
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
    if (contacts) {
      let ids = contacts.map((c) => c.id);
      if (audienceFilter?.excluded_contact_ids?.length) {
        const excludedSet = new Set(audienceFilter.excluded_contact_ids);
        ids = ids.filter((id) => !excludedSet.has(id));
      }
      contactIds.push(...ids);
    }
  }

  // 2. Extra emails → find/create contacts
  if (audienceFilter?.extra_emails?.length) {
    const extraIds = await resolveExtraEmails(audienceFilter.extra_emails);
    contactIds.push(...extraIds);
  }

  // Deduplicate
  return [...new Set(contactIds)];
}

/**
 * Enroll audience contacts into an email drip campaign.
 */
export async function enrollEmailAudience(
  campaignId: string,
  audienceFilter: AudienceFilter | null
): Promise<number> {
  const contactIds = await getEmailAudienceContactIds(audienceFilter);
  if (!contactIds.length) return 0;

  const { data: existing } = await supabaseAdmin.from("drip_enrollments")
    .select("contact_id")
    .eq("campaign_id", campaignId)
    .in("contact_id", contactIds)
    .in("status", ["active", "paused"]);

  const alreadyEnrolled = new Set((existing ?? []).map((e) => e.contact_id));
  const toEnroll = contactIds.filter((id) => !alreadyEnrolled.has(id));

  if (!toEnroll.length) return 0;

  const { data: firstStep } = await supabaseAdmin
    .from("email_steps")
    .select("id, order")
    .eq("campaign_id", campaignId)
    .order("order", { ascending: true })
    .limit(1)
    .single();

  const firstOrder = firstStep?.order ?? 1;
  const firstStepId = firstStep?.id ?? null;
  const now = new Date().toISOString();

  const rows = toEnroll.map((contactId) => ({
    contact_id: contactId,
    campaign_id: campaignId,
    campaign_type: "email" as const,
    current_step_order: firstOrder,
    current_step_id: firstStepId,
    status: "active" as const,
    next_send_at: now,
  }));

  const { error } = await supabaseAdmin.from("drip_enrollments")
    .insert(rows);

  if (error) {
    console.error("[Email Enroll] Bulk insert error:", error.message);
    return 0;
  }

  return toEnroll.length;
}
