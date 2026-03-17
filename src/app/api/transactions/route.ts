import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { expenseSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;

  const type = sp.get("type"); // income | expense
  const category = sp.get("category");
  const from = sp.get("from");
  const to = sp.get("to");
  const search = sp.get("search");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25")));

  let query = supabase
    .from("transactions")
    .select("*, contacts(id, first_name, last_name)", { count: "exact" });

  if (type) query = query.eq("type", type);
  if (category) query = query.eq("category", category);
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);
  if (search) query = query.ilike("description", `%${search}%`);

  query = query
    .order("date", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data: inserted, error } = await supabase
    .from("transactions")
    .insert({
      type: "expense",
      amount: parsed.data.amount,
      category: parsed.data.category,
      date: parsed.data.date,
      description: parsed.data.description || null,
      gst_applicable: parsed.data.gst_applicable,
      receipt_url: parsed.data.receipt_url || null,
      contact_id: parsed.data.contact_id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
