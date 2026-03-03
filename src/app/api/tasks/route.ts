import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { taskSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status") ?? "";
  const priority = searchParams.get("priority") ?? "";
  const type = searchParams.get("type") ?? "";
  const contactId = searchParams.get("contact_id") ?? "";
  const assignedTo = searchParams.get("assigned_to") ?? "";
  const dueBefore = searchParams.get("due_before") ?? "";
  const dueAfter = searchParams.get("due_after") ?? "";
  const sort = searchParams.get("sort") ?? "due_at";
  const order = searchParams.get("order") ?? "asc";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25")));

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("tasks")
    .select(
      "*, contacts(id, first_name, last_name), team_members:team_members!tasks_assigned_to_fkey(id, name)",
      { count: "exact" }
    );

  if (status === "overdue") {
    query = query
      .in("status", ["pending", "overdue"])
      .lt("due_at", new Date().toISOString())
      .not("due_at", "is", null);
  } else if (status) {
    query = query.eq("status", status);
  }

  if (priority) query = query.eq("priority", priority);
  if (type) query = query.eq("type", type);
  if (contactId) query = query.eq("contact_id", contactId);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);
  if (dueBefore) query = query.lte("due_at", dueBefore);
  if (dueAfter) query = query.gte("due_at", dueAfter);

  const ascending = order === "asc";
  // Put nulls last for due_at sorting
  query = query
    .order(sort, { ascending, nullsFirst: false })
    .range(from, to);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((count ?? 0) / perPage),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json();
  const parsed = taskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Clean empty strings to null for FK fields
  const cleaned: Record<string, unknown> = { ...parsed.data };
  for (const key of ["contact_id", "assigned_to"]) {
    if (cleaned[key] === "") cleaned[key] = null;
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert(cleaned)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
