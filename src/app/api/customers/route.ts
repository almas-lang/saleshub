import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const params = request.nextUrl.searchParams;

  const page = Math.max(1, parseInt(params.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(params.get("per_page") ?? "25")));
  const search = params.get("search")?.trim() ?? "";
  const sort = params.get("sort") ?? "converted_at";
  const order = params.get("order") ?? "desc";
  const program = params.get("program") ?? "";

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("contacts")
    .select(
      "*, funnel_stages(id, name, color), funnels(id, name), team_members(id, name)",
      { count: "exact" }
    )
    .eq("type", "customer")
    .is("deleted_at", null);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const ascending = order === "asc";
  query = query.order(sort, { ascending, nullsFirst: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If filtering by program, fetch programs for these contacts
  const contactIds = (data ?? []).map((c) => c.id);
  let programs: Record<string, unknown[]> = {};

  if (contactIds.length > 0) {
    let progQuery = supabase
      .from("customer_programs")
      .select("*, team_members(id, name)")
      .in("contact_id", contactIds);

    if (program) {
      progQuery = progQuery.eq("program_name", program);
    }

    const { data: progData } = await progQuery;
    if (progData) {
      programs = {};
      for (const p of progData) {
        if (!programs[p.contact_id]) programs[p.contact_id] = [];
        programs[p.contact_id].push(p);
      }
    }
  }

  // If filtering by program, only return contacts that have matching programs
  let filteredData = data ?? [];
  if (program) {
    filteredData = filteredData.filter((c) => programs[c.id]?.length > 0);
  }

  return NextResponse.json({
    data: filteredData.map((c) => ({
      ...c,
      programs: programs[c.id] ?? [],
    })),
    total: program ? filteredData.length : count ?? 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((program ? filteredData.length : count ?? 0) / perPage),
  });
}
