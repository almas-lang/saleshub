import type { AudienceFilter } from "@/types/campaigns";

/**
 * Builds URLSearchParams for the unified /api/campaigns/audience-count endpoint.
 * Handles both old single-value and new multi-value filter fields.
 */
export function buildAudienceCountParams(
  filter: AudienceFilter,
  channel: "whatsapp" | "email" = "whatsapp"
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("channel", channel);

  // Multi-value (new) takes precedence over single-value (old)
  const sources = filter.sources?.length ? filter.sources : filter.source ? [filter.source] : [];
  if (sources.length > 0) params.set("sources", sources.join(","));

  const funnelIds = filter.funnel_ids?.length ? filter.funnel_ids : filter.funnel_id ? [filter.funnel_id] : [];
  if (funnelIds.length > 0) params.set("funnel_ids", funnelIds.join(","));

  const stageIds = filter.stage_ids?.length ? filter.stage_ids : filter.stage_id ? [filter.stage_id] : [];
  if (stageIds.length > 0) params.set("stage_ids", stageIds.join(","));

  const assignedTos = filter.assigned_tos?.length ? filter.assigned_tos : filter.assigned_to ? [filter.assigned_to] : [];
  if (assignedTos.length > 0) params.set("assigned_tos", assignedTos.join(","));

  if (filter.tags?.length) params.set("tags", filter.tags.join(","));
  if (filter.include_archived) params.set("include_archived", "true");
  if (filter.created_after) params.set("created_after", filter.created_after);
  if (filter.created_before) params.set("created_before", filter.created_before);
  if (filter.in_campaigns?.length) params.set("in_campaigns", filter.in_campaigns.join(","));
  if (filter.not_in_campaigns?.length) params.set("not_in_campaigns", filter.not_in_campaigns.join(","));
  if (filter.booking_statuses?.length) params.set("booking_statuses", filter.booking_statuses.join(","));

  return params;
}
