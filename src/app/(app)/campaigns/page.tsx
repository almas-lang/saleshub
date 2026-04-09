import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { UnifiedCampaignListClient } from "@/components/communication/unified-campaign-list";

export default async function CampaignsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data: campaigns, error } = await supabase
    .from("unified_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch enrollment stats per campaign
  const campaignIds = (campaigns ?? []).map((c: { id: string }) => c.id);
  let statsMap: Record<string, { enrolled: number; active: number; completed: number; stopped: number }> = {};

  if (campaignIds.length > 0) {
    const { data: enrollments } = await supabaseAdmin
      .from("drip_enrollments")
      .select("campaign_id, status")
      .eq("campaign_type", "unified")
      .in("campaign_id", campaignIds);

    for (const e of enrollments ?? []) {
      if (!statsMap[e.campaign_id]) {
        statsMap[e.campaign_id] = { enrolled: 0, active: 0, completed: 0, stopped: 0 };
      }
      statsMap[e.campaign_id].enrolled++;
      if (e.status === "active") statsMap[e.campaign_id].active++;
      else if (e.status === "completed") statsMap[e.campaign_id].completed++;
      else if (e.status === "stopped" || e.status === "paused") statsMap[e.campaign_id].stopped++;
    }
  }

  // Count steps per campaign
  let stepCounts: Record<string, number> = {};
  if (campaignIds.length > 0) {
    const { data: steps } = await supabaseAdmin
      .from("unified_steps")
      .select("campaign_id")
      .in("campaign_id", campaignIds)
      .not("step_type", "eq", "condition");

    for (const s of steps ?? []) {
      stepCounts[s.campaign_id] = (stepCounts[s.campaign_id] ?? 0) + 1;
    }
  }

  const campaignsWithStats = (campaigns ?? []).map((c: Record<string, unknown>) => ({
    ...c,
    stats: statsMap[c.id as string] ?? { enrolled: 0, active: 0, completed: 0, stopped: 0 },
    step_count: stepCounts[c.id as string] ?? 0,
  }));

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Unified drip sequences mixing WhatsApp and Email in a single flow.
        </p>
      </div>

      <UnifiedCampaignListClient
        campaigns={error ? [] : campaignsWithStats}
      />
    </div>
  );
}
