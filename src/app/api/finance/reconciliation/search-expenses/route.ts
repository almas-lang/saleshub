export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const amount = searchParams.get("amount");

  let query = supabaseAdmin
    .from("transactions")
    .select("id, amount, date, description, category, payment_mode")
    .eq("type", "expense")
    .order("date", { ascending: false })
    .limit(20);

  if (q) {
    query = query.or(`description.ilike.%${q}%,category.ilike.%${q}%`);
  }

  if (amount) {
    const amt = parseFloat(amount);
    if (!isNaN(amt)) {
      query = query.gte("amount", amt - 1).lte("amount", amt + 1);
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
