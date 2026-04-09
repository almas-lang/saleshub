import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UnifiedCampaignWizard } from "@/components/communication/unified-campaign-wizard";

export default async function EditUnifiedCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // Load campaign
  const { data: campaign, error: campaignError } = await supabase
    .from("unified_campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (campaignError || !campaign) notFound();

  // Load filter options (same as /campaigns/new)
  const [funnelsResult, membersResult, sourcesResult] = await Promise.all([
    supabase
      .from("funnels")
      .select("id, name, funnel_stages(id, name, funnel_id, order)")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("team_members")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("contacts")
      .select("source")
      .eq("type", "prospect")
      .is("deleted_at", null)
      .not("source", "is", null),
  ]);

  const funnels = (funnelsResult.data ?? []).map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }));

  const stages = (funnelsResult.data ?? []).flatMap((f: { funnel_stages?: { id: string; name: string; funnel_id: string; order: number }[] }) =>
    (f.funnel_stages ?? []).map((s) => ({ id: s.id, name: s.name, funnel_id: s.funnel_id, order: s.order }))
  );

  const teamMembers = (membersResult.data ?? []).map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }));

  const sources = [
    ...new Set(
      (sourcesResult.data ?? []).map((c: { source: string }) => c.source).filter(Boolean)
    ),
  ].sort() as string[];

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/campaigns"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Edit Campaign</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {campaign.name}
        </p>
      </div>

      <UnifiedCampaignWizard
        funnels={funnels}
        stages={stages}
        teamMembers={teamMembers}
        sources={sources}
        existingCampaign={{
          id: campaign.id,
          name: campaign.name,
          type: campaign.type,
          status: campaign.status,
          audience_filter: campaign.audience_filter,
          stop_condition: campaign.stop_condition,
          flow_data: campaign.flow_data,
        }}
      />
    </div>
  );
}
