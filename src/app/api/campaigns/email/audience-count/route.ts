import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const params = request.nextUrl.searchParams;

  const source = params.get("source") ?? "";
  const funnelId = params.get("funnel_id") ?? "";
  const stageId = params.get("stage_id") ?? "";
  const assignedTo = params.get("assigned_to") ?? "";
  const tags = params.get("tags") ?? "";

  // "Custom emails only" — no filter-based contacts
  if (source === "__custom_only__") {
    return NextResponse.json({ count: 0 });
  }

  let query = supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("type", "prospect")
    .is("deleted_at", null)
    .not("email", "is", null);

  if (source) query = query.eq("source", source);
  if (funnelId) query = query.eq("funnel_id", funnelId);
  if (stageId) query = query.eq("current_stage_id", stageId);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);
  if (tags) {
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (tagList.length > 0) {
      query = query.overlaps("tags", tagList);
    }
  }

  const { count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
