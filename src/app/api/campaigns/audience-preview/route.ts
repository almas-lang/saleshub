import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatusFilter } from "@/types/campaigns";

const PAGE_SIZE = 50;

/**
 * Paginated audience preview — returns actual contact rows matching filters.
 * Same filter params as /api/campaigns/audience-count plus `page` (1-indexed).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const p = request.nextUrl.searchParams;

  const channel = p.get("channel") ?? "whatsapp";
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10));

  // Parse filters (same as audience-count)
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

  // Build base query
  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, source, created_at, current_stage_id, funnel_stages!contacts_current_stage_id_fkey(name)")
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

  // For advanced filters, we need to get all IDs first then paginate
  const needsAdvancedQuery = bookingStatuses.length > 0 || inCampaigns.length > 0 || notInCampaigns.length > 0;

  if (needsAdvancedQuery) {
    // Get all matching contact IDs with basic filters
    const { data: baseContacts, error: baseErr } = await query;
    if (baseErr) return NextResponse.json({ error: baseErr.message }, { status: 500 });
    if (!baseContacts || baseContacts.length === 0) {
      return NextResponse.json({ contacts: [], total: 0, page, pageSize: PAGE_SIZE });
    }

    let contactIds = baseContacts.map((c) => c.id);

    // Filter by enrollment
    if (inCampaigns.length > 0) {
      const { data: enrolled } = await supabase
        .from("drip_enrollments")
        .select("contact_id")
        .in("campaign_id", inCampaigns)
        .in("contact_id", contactIds);
      const enrolledSet = new Set((enrolled ?? []).map((e) => e.contact_id));
      contactIds = contactIds.filter((id) => enrolledSet.has(id));
    }

    if (notInCampaigns.length > 0 && contactIds.length > 0) {
      const { data: excluded } = await supabase
        .from("drip_enrollments")
        .select("contact_id")
        .in("campaign_id", notInCampaigns)
        .in("contact_id", contactIds);
      const excludedSet = new Set((excluded ?? []).map((e) => e.contact_id));
      contactIds = contactIds.filter((id) => !excludedSet.has(id));
    }

    // Filter by booking status
    if (bookingStatuses.length > 0 && contactIds.length > 0) {
      const hasNeverBooked = bookingStatuses.includes("never_booked");
      const actualStatuses = bookingStatuses.filter((s) => s !== "never_booked");

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
        if (!statuses) return hasNeverBooked;
        if (actualStatuses.length === 0) return false;
        return statuses.some((s) => (actualStatuses as string[]).includes(s));
      });
    }

    // Now paginate from the filtered IDs
    const total = contactIds.length;
    const pageIds = contactIds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Look up booking status for the page contacts
    const contactMap = new Map(baseContacts.map((c) => [c.id, c]));
    const { data: pageBookings } = await supabase
      .from("bookings")
      .select("contact_id, status")
      .in("contact_id", pageIds)
      .order("created_at", { ascending: false });

    const latestBooking = new Map<string, string>();
    for (const b of pageBookings ?? []) {
      if (!latestBooking.has(b.contact_id)) latestBooking.set(b.contact_id, b.status);
    }

    const contacts = pageIds.map((id) => {
      const c = contactMap.get(id)!;
      return {
        id: c.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
        email: c.email,
        phone: c.phone,
        source: c.source,
        created_at: c.created_at,
        stage: (c.funnel_stages as unknown as { name: string }[] | null)?.[0]?.name ?? null,
        booking_status: latestBooking.get(id) ?? "never_booked",
      };
    });

    return NextResponse.json({ contacts, total, page, pageSize: PAGE_SIZE });
  }

  // Simple query — use Supabase pagination
  const from = (page - 1) * PAGE_SIZE;
  const countQuery = supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("type", "prospect")
    .eq("is_customer", false)
    .is("deleted_at", null);

  // Apply same filters to count query
  let cq = countQuery;
  if (channel === "whatsapp") cq = cq.not("phone", "is", null);
  else cq = cq.not("email", "is", null);
  if (!includeArchived) cq = cq.is("archived_at", null);
  if (sources.length > 0) cq = cq.in("source", sources);
  if (funnelIds.length > 0) cq = cq.in("funnel_id", funnelIds);
  if (stageIds.length > 0) cq = cq.in("current_stage_id", stageIds);
  if (assignedTos.length > 0) cq = cq.in("assigned_to", assignedTos);
  if (tags.length > 0) cq = cq.overlaps("tags", tags);
  if (createdAfter) cq = cq.gte("created_at", createdAfter);
  if (createdBefore) cq = cq.lte("created_at", createdBefore + "T23:59:59.999Z");

  const [dataResult, countResult] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
    cq,
  ]);

  if (dataResult.error) return NextResponse.json({ error: dataResult.error.message }, { status: 500 });

  const contactIds = (dataResult.data ?? []).map((c) => c.id);

  // Fetch latest booking status for these contacts
  const { data: bookings } = contactIds.length > 0
    ? await supabase
        .from("bookings")
        .select("contact_id, status")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const latestBooking = new Map<string, string>();
  for (const b of bookings ?? []) {
    if (!latestBooking.has(b.contact_id)) latestBooking.set(b.contact_id, b.status);
  }

  const contacts = (dataResult.data ?? []).map((c) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
    email: c.email,
    phone: c.phone,
    source: c.source,
    created_at: c.created_at,
    stage: (c.funnel_stages as unknown as { name: string }[] | null)?.[0]?.name ?? null,
    booking_status: latestBooking.get(c.id) ?? "never_booked",
  }));

  return NextResponse.json({
    contacts,
    total: countResult.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}

function csv(val: string | null): string[] | null {
  if (!val) return null;
  const items = val.split(",").map((s) => s.trim()).filter(Boolean);
  return items.length > 0 ? items : null;
}
