import { NextResponse } from "next/server";
import { syncMetaAdsToDb } from "@/lib/meta-ads/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron (01:00 UTC / 06:30 IST): auto-sync yesterday's Meta ad spend.
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
    // Yesterday in YYYY-MM-DD
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const result = await syncMetaAdsToDb(yesterday, yesterday);

    console.log(
      `[Meta Ad Sync] Imported ${result.inserted} entries for ${yesterday}`
    );

    return NextResponse.json({
      success: true,
      date: yesterday,
      ...result,
    });
  } catch (error) {
    console.error("[Meta Ad Sync] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
