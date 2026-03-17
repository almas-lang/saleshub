import { NextRequest, NextResponse } from "next/server";
import { getPipelineAnalytics } from "@/lib/analytics/queries";

export async function GET(request: NextRequest) {
  const funnelId = request.nextUrl.searchParams.get("funnel_id");

  if (!funnelId) {
    return NextResponse.json(
      { error: "funnel_id is required" },
      { status: 400 }
    );
  }

  try {
    const data = await getPipelineAnalytics(funnelId);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
