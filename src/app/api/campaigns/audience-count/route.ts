import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatusFilter } from "@/types/campaigns";

/**
 * Unified audience count endpoint.
 * Supports both legacy single-value params and new multi-value params.
 * Multi-value params use comma-separated values.
 *
 * New params: sources, funnel_ids, stage_ids, assigned_tos,
 *   created_after, created_before, in_campaigns, not_in_campaigns, booking_statuses
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const p = request.nextUrl.searchParams;

  // Channel determines required field (phone vs email)
  const channel = p.get("channel") ?? "whatsapp";

  // ── Parse filters (support both old single + new multi) ──
  const sources = csv(p.get("sources")) ?? (p.get("source") ? [p.get("source")!] : []);
  const funnelIds = csv(p.get("funnel_ids")) ?? (p.get("funnel_id") ? [p.get("funnel_id")!] : []);
  const stageIds = csv(p.get("stage_ids")) ?? (p.get("stage_id") ? [p.get("stage_id")!] : []);
  const assignedTos = csv(p.get("assigned_tos")) ?? (p.get("assigned_to") ? [p.get("assigned_to")!] : []);
  const tags = csv(p.get("tags")) ?? [];
  const includeArchived = p.get("include_archived") === "true";
  const createdAfter = p.get("created_after") ?? "";
  const createdBefore = p.get("created_before") ?? "";
  const inCampaigns = csv(p.get("in_campaigns")) ?? [];
  const notInCampaigns = csv(p.get("not_in_campaigns")) ?? [];
  const bookingStatuses = (csv(p.get("booking_statuses")) ?? []) as BookingStatusFilter[];

  // Email "custom only" shortcut
  if (sources.length === 1 && sources[0] === "__custom_only__") {
    return NextResponse.json({ count: 0 });
  }

  // ── Subquery approach for complex filters ──
  // We need to use raw SQL for booking/enrollment joins.
  // If we have booking or campaign filters, use RPC-style raw query.
  const needsAdvancedQuery = bookingStatuses.length > 0 || inCampaigns.length > 0 || notInCampaigns.length > 0;

  if (needsAdvancedQuery) {
    const { conditions, params } = buildConditions({
      channel, sources, funnelIds, stageIds, assignedTos, tags,
      includeArchived, createdAfter, createdBefore,
      inCampaigns, notInCampaigns, bookingStatuses,
    });

    // Use a raw count query via Supabase's rpc or direct SQL
    // Since there's no RPC yet, we'll use a two-step approach:
    // 1. Get contact IDs matching basic filters
    // 2. Filter by bookings/enrollments in JS
    // This is simpler than creating a migration for an RPC function.

    // Step 1: Get base contacts
    let query = supabase
      .from("contacts")
      .select("id")
      .eq("type", "prospect")
      .eq("is_customer", false)
      .is("deleted_at", null);

    if (channel === "whatsapp") query = query.not("phone", "is", null);
    else query = query.not("email", "is", null);

    if (!includeArchived) query = query.is("archived_at", null);
    if (sources.length > 0) query = query.in("source", sources);
    if (funnelIds.length > 0) query = query.in("funnel_id", funnelIds);
    if (stageIds.length > 0) query = query.in("current_stage_id", stageIds);
    if (assignedTos.length > 0) query = query.in("assigned_to", assignedTos);
    if (tags.length > 0) query = query.overlaps("tags", tags);
    if (createdAfter) query = query.gte("created_at", createdAfter);
    if (createdBefore) query = query.lte("created_at", createdBefore + "T23:59:59.999Z");

    const { data: baseContacts, error: baseErr } = await query;
    if (baseErr) return NextResponse.json({ error: baseErr.message }, { status: 500 });
    if (!baseContacts || baseContacts.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    let contactIds = baseContacts.map((c) => c.id);

    // Step 2: Filter by enrollment (in campaigns)
    if (inCampaigns.length > 0) {
      const { data: enrolled } = await supabase
        .from("drip_enrollments")
        .select("contact_id")
        .in("campaign_id", inCampaigns)
        .in("contact_id", contactIds);
      const enrolledSet = new Set((enrolled ?? []).map((e) => e.contact_id));
      contactIds = contactIds.filter((id) => enrolledSet.has(id));
    }

    // Step 3: Filter by NOT enrolled
    if (notInCampaigns.length > 0 && contactIds.length > 0) {
      const { data: excluded } = await supabase
        .from("drip_enrollments")
        .select("contact_id")
        .in("campaign_id", notInCampaigns)
        .in("contact_id", contactIds);
      const excludedSet = new Set((excluded ?? []).map((e) => e.contact_id));
      contactIds = contactIds.filter((id) => !excludedSet.has(id));
    }

    // Step 4: Filter by booking status
    if (bookingStatuses.length > 0 && contactIds.length > 0) {
      const hasNeverBooked = bookingStatuses.includes("never_booked");
      const actualStatuses = bookingStatuses.filter((s) => s !== "never_booked");

      if (hasNeverBooked && actualStatuses.length === 0) {
        // Only "never_booked" — exclude contacts with any booking
        const { data: booked } = await supabase
          .from("bookings")
          .select("contact_id")
          .in("contact_id", contactIds);
        const bookedSet = new Set((booked ?? []).map((b) => b.contact_id));
        contactIds = contactIds.filter((id) => !bookedSet.has(id));
      } else if (!hasNeverBooked) {
        // Only actual statuses — include contacts with at least one matching booking
        const { data: matching } = await supabase
          .from("bookings")
          .select("contact_id")
          .in("status", actualStatuses)
          .in("contact_id", contactIds);
        const matchSet = new Set((matching ?? []).map((b) => b.contact_id));
        contactIds = contactIds.filter((id) => matchSet.has(id));
      } else {
        // Both "never_booked" + actual statuses — union: no bookings OR has matching status
        const { data: allBookings } = await supabase
          .from("bookings")
          .select("contact_id, status")
          .in("contact_id", contactIds);

        const contactBookings = new Map<string, string[]>();
        for (const b of allBookings ?? []) {
          if (!contactBookings.has(b.contact_id)) contactBookings.set(b.contact_id, []);
          contactBookings.get(b.contact_id)!.push(b.status);
        }

        contactIds = contactIds.filter((id) => {
          const statuses = contactBookings.get(id);
          if (!statuses) return true; // never booked
          return statuses.some((s) => (actualStatuses as string[]).includes(s));
        });
      }
    }

    return NextResponse.json({ count: contactIds.length });
  }

  // ── Simple query (no booking/enrollment joins needed) ──
  let query = supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("type", "prospect")
    .eq("is_customer", false)
    .is("deleted_at", null);

  if (channel === "whatsapp") query = query.not("phone", "is", null);
  else query = query.not("email", "is", null);

  if (!includeArchived) query = query.is("archived_at", null);
  if (sources.length > 0) query = query.in("source", sources);
  if (funnelIds.length > 0) query = query.in("funnel_id", funnelIds);
  if (stageIds.length > 0) query = query.in("current_stage_id", stageIds);
  if (assignedTos.length > 0) query = query.in("assigned_to", assignedTos);
  if (tags.length > 0) query = query.overlaps("tags", tags);
  if (createdAfter) query = query.gte("created_at", createdAfter);
  if (createdBefore) query = query.lte("created_at", createdBefore + "T23:59:59.999Z");

  const { count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ count: count ?? 0 });
}

// ── Helpers ──

function csv(val: string | null): string[] | null {
  if (!val) return null;
  const items = val.split(",").map((s) => s.trim()).filter(Boolean);
  return items.length > 0 ? items : null;
}

/** Build SQL conditions — only used for type-checking params right now */
function buildConditions(opts: {
  channel: string;
  sources: string[];
  funnelIds: string[];
  stageIds: string[];
  assignedTos: string[];
  tags: string[];
  includeArchived: boolean;
  createdAfter: string;
  createdBefore: string;
  inCampaigns: string[];
  notInCampaigns: string[];
  bookingStatuses: BookingStatusFilter[];
}) {
  return { conditions: [], params: opts };
}
