/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/finance/paid-traffic-overrides?from=YYYY-MM-DD&to=YYYY-MM-DD&platform=meta
 * Returns all overrides for the given date range.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const platform = sp.get("platform") ?? "meta";

  if (!from || !to) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 });
  }

  const { data, error } = await (supabaseAdmin as any)
    .from("paid_traffic_overrides")
    .select("*")
    .eq("platform", platform)
    .gte("date", from)
    .lte("date", to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

/**
 * POST /api/finance/paid-traffic-overrides
 * Upsert an override for a specific date/platform/field.
 * Body: { date, platform?, field, originalValue, overrideValue, note? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get team member ID
  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const body = await request.json();
  const { date, platform = "meta", field, originalValue, overrideValue, note } = body;

  if (!date || !field || overrideValue === undefined) {
    return NextResponse.json(
      { error: "date, field, and overrideValue are required" },
      { status: 400 }
    );
  }

  const { data, error } = await (supabaseAdmin as any)
    .from("paid_traffic_overrides")
    .upsert(
      {
        date,
        platform,
        field,
        original_value: originalValue ?? null,
        override_value: overrideValue,
        note: note ?? null,
        updated_by: member?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "date,platform,field" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/finance/paid-traffic-overrides
 * Remove an override (revert to original value).
 * Body: { date, platform?, field }
 */
export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { date, platform = "meta", field } = body;

  if (!date || !field) {
    return NextResponse.json({ error: "date and field required" }, { status: 400 });
  }

  const { error } = await (supabaseAdmin as any)
    .from("paid_traffic_overrides")
    .delete()
    .eq("date", date)
    .eq("platform", platform)
    .eq("field", field);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
