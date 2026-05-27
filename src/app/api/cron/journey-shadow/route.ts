import { NextResponse } from "next/server";
import { runShadow } from "@/lib/campaigns/v2/shadow";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export { GET as POST };

/**
 * Shadow-mode cron. Walks active legacy enrollments, runs the v2 engine in
 * dryRun, and writes a `shadow_plan` event per enrollment to journey_event_log.
 * No sends, no enrollment mutations — read-only confidence gate before any
 * campaign is flipped to engine='v2'.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const querySecret = new URL(request.url).searchParams.get("secret");
  const authed = authHeader === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET;
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await runShadow({});
    if (res.totalEnrollments || res.totalErrors) {
      await logger.info(
        "journey-shadow",
        `shadowed ${res.totalEnrollments} enrollments across ${res.campaigns.length} campaigns; ${res.totalDivergent} divergent, ${res.totalErrors} errors`,
        { ...res },
      );
    }
    return NextResponse.json({ success: true, ...res });
  } catch (error) {
    await logger.error("journey-shadow", `error: ${error instanceof Error ? error.message : "unknown"}`);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
