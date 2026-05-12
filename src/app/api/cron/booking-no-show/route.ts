import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/booking-no-show
 *
 * Sweeps confirmed bookings whose end time has passed (with a grace window) and
 * marks them `no_show`. Anyone who actually attended should have been moved to
 * `completed` manually before this runs — so this only catches the ones nobody
 * touched, making the "attended" funnel step honest instead of dependent on
 * staff remembering to click.
 *
 * Runs every 3 hours (see vercel.json). Grace window: 4 hours after end time.
 */
const GRACE_HOURS = 4;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret");
  const isAuthed =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - GRACE_HOURS * 60 * 60 * 1000).toISOString();

  const { data: stale, error: selectError } = await supabaseAdmin
    .from("bookings")
    .select("id, contact_id, booking_page_id, ends_at")
    .eq("status", "confirmed")
    .lt("ends_at", cutoff);

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  if (!stale || stale.length === 0) {
    return NextResponse.json({ ok: true, marked_no_show: 0 });
  }

  const ids = stale.map((b) => b.id);
  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({ status: "no_show" })
    .in("id", ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Timeline note per contact so the no-show is visible in the CRM.
  const activities = stale.map((b) => ({
    contact_id: b.contact_id,
    type: "note" as const,
    title: "Marked as no-show (auto)",
    metadata: { booking_id: b.id, ends_at: b.ends_at, reason: "no manual outcome within grace window" },
  }));
  await supabaseAdmin.from("activities").insert(activities);

  return NextResponse.json({ ok: true, marked_no_show: ids.length });
}
