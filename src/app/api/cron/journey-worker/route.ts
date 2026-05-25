import { NextResponse } from "next/server";
import { processDueRuns } from "@/lib/campaigns/v2/worker";
import { drainOutbox } from "@/lib/campaigns/v2/outbox";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export { GET as POST };

/**
 * v2 journey worker cron. Runs due engine=v2 journeys through the engine, then
 * drains the outbox (Resend + WhatsApp) with retry/exactly-once. Legacy campaigns
 * stay on /api/cron/drip-processor until migrated.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const querySecret = new URL(request.url).searchParams.get("secret");
  const authed = authHeader === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET;
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const plans = await processDueRuns({});
    const drain = await drainOutbox({});
    const sends = plans.reduce((n, p) => n + p.sends.length, 0);
    const completed = plans.filter((p) => p.terminate).length;
    if (plans.length || drain.sent || drain.failed || drain.dead) {
      await logger.info("journey-worker", `ran ${plans.length} journeys (${sends} queued, ${completed} completed); outbox ${drain.sent} sent`, { runs: plans.length, queued: sends, completed, ...drain });
    }
    return NextResponse.json({ success: true, runs: plans.length, queued: sends, completed, outbox: drain });
  } catch (error) {
    await logger.error("journey-worker", `error: ${error instanceof Error ? error.message : "unknown"}`);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
