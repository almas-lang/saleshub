import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contactSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const params = request.nextUrl.searchParams;

  const page = Math.max(1, parseInt(params.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(params.get("per_page") ?? "25")));
  const search = params.get("search")?.trim() ?? "";
  const source = params.get("source") ?? "";
  const funnelId = params.get("funnel_id") ?? "";
  const stageId = params.get("stage_id") ?? "";
  const assignedTo = params.get("assigned_to") ?? "";
  const tags = params.get("tags") ?? "";
  const sort = params.get("sort") ?? "created_at";
  const order = params.get("order") ?? "desc";

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("contacts")
    .select(
      "*, funnel_stages(id, name, color), funnels(id, name), team_members(id, name)",
      { count: "exact" }
    )
    .eq("type", "prospect")
    .is("deleted_at", null);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,company_name.ilike.%${search}%`
    );
  }

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

  const ascending = order === "asc";
  query = query.order(sort, { ascending }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;

  return NextResponse.json({
    data: data ?? [],
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json();
  const parsed = contactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Clean empty strings to null for FK fields
  const cleaned: Record<string, unknown> = { ...parsed.data, type: "prospect" };
  for (const key of ["email", "funnel_id", "current_stage_id", "assigned_to", "linkedin_url"]) {
    if (cleaned[key] === "") cleaned[key] = null;
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert(cleaned)
    .select("*, funnel_stages(id, name, color), funnels(id, name), team_members(id, name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
