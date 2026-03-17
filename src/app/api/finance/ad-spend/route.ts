import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adSpendSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;

  const platform = sp.get("platform");
  const from = sp.get("from");
  const to = sp.get("to");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25")));

  let query = supabase.from("ad_spend")
    .select("*", { count: "exact" });

  if (platform) query = query.eq("platform", platform);
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

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

  const parsed = adSpendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.from("ad_spend")
    .insert({
      platform: parsed.data.platform,
      campaign_name: parsed.data.campaign_name,
      campaign_id: parsed.data.campaign_id || null,
      date: parsed.data.date,
      amount: parsed.data.amount,
      impressions: parsed.data.impressions,
      clicks: parsed.data.clicks,
      leads: parsed.data.leads,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
