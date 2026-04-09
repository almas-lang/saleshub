import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaign_id");

  if (!campaignId) {
    return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
  }

  // Fetch enrollments with contact info
  const { data: enrollments, error } = await supabaseAdmin
    .from("drip_enrollments")
    .select("id, contact_id, status, current_step_order, next_send_at, created_at, contacts(first_name, last_name, email, phone)")
    .eq("campaign_id", campaignId)
    .eq("campaign_type", "unified")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate stats
  const stats = { total: 0, active: 0, completed: 0, stopped: 0, paused: 0 };
  for (const e of enrollments ?? []) {
    stats.total++;
    if (e.status === "active") stats.active++;
    else if (e.status === "completed") stats.completed++;
    else if (e.status === "paused") stats.paused++;
    else stats.stopped++;
  }

  // Normalize contact join
  const normalized = (enrollments ?? []).map((e) => ({
    id: e.id,
    contact_id: e.contact_id,
    status: e.status,
    current_step_order: e.current_step_order,
    next_send_at: e.next_send_at,
    created_at: e.created_at,
    contact: e.contacts as { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null,
  }));

  return NextResponse.json({ enrollments: normalized, stats });
}
