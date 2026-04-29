import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const params = request.nextUrl.searchParams;
  const search = params.get("q")?.trim() ?? "";
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")));

  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company_name")
    .is("deleted_at", null)
    .is("archived_at", null);

  if (search) {
    const escaped = search.replace(/[,()]/g, " ");
    query = query.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,company_name.ilike.%${escaped}%`
    );
  }

  query = query.order("first_name", { ascending: true }).limit(limit);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
