import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hard-deletes contacts that were soft-deleted more than 30 days ago.
 * Related records (activities, email_sends, bookings, invoices, drip_enrollments, etc.)
 * are automatically removed via ON DELETE CASCADE.
 *
 * Schedule: Weekly on Sundays at 2:00 AM UTC (vercel.json)
 */
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

  try {
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Find contacts soft-deleted more than 30 days ago
    const { data: staleContacts, error: fetchError } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .not("deleted_at", "is", null)
      .lt("deleted_at", thirtyDaysAgo)
      .limit(500);

    if (fetchError) {
      console.error("[Cleanup] Failed to fetch deleted contacts:", fetchError.message);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!staleContacts || staleContacts.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    const ids = staleContacts.map((c) => c.id);

    const { error: deleteError } = await supabaseAdmin
      .from("contacts")
      .delete()
      .in("id", ids);

    if (deleteError) {
      console.error("[Cleanup] Hard delete failed:", deleteError.message);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log(`[Cleanup] Hard-deleted ${ids.length} contacts`);
    return NextResponse.json({ deleted: ids.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Cleanup] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
