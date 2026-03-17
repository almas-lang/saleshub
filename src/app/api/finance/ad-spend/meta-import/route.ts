import { NextRequest, NextResponse } from "next/server";
import { syncMetaAdsToDb } from "@/lib/meta-ads/client";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { from, to } = body;

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to dates are required" },
      { status: 400 }
    );
  }

  try {
    const result = await syncMetaAdsToDb(from, to);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
