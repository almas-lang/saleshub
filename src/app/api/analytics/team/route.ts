import { NextRequest, NextResponse } from "next/server";
import { getTeamAnalytics } from "@/lib/analytics/queries";
import { subDays, format } from "date-fns";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const from = sp.get("from") ?? format(subDays(new Date(), 29), "yyyy-MM-dd");
  const to = sp.get("to") ?? format(new Date(), "yyyy-MM-dd");

  try {
    const data = await getTeamAnalytics(from, to);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
