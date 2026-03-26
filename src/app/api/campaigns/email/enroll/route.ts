import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrollEmailAudience } from "@/lib/campaigns/email-audience";
import type { AudienceFilter } from "@/types/campaigns";

export async function POST(request: Request) {
  const supabase = await createClient();

  let body: { campaign_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { campaign_id } = body;
  if (!campaign_id) {
    return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
  }

  const { data: campaign, error: campError } = await supabase
    .from("email_campaigns")
    .select("id, type, status, audience_filter")
    .eq("id", campaign_id)
    .single();

  if (campError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (campaign.type !== "drip") {
    return NextResponse.json({ error: "Only drip campaigns can be enrolled" }, { status: 400 });
  }
  if (campaign.status !== "active") {
    return NextResponse.json({ error: "Campaign must be active to enroll" }, { status: 400 });
  }

  const enrolled = await enrollEmailAudience(campaign_id, campaign.audience_filter as AudienceFilter | null);

  return NextResponse.json({ enrolled });
}
