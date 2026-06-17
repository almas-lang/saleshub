import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CampaignWizard } from "@/components/communication/campaign-wizard";
import { SetBreadcrumb } from "@/components/layout/breadcrumb-context";
import type { AudienceFilter, FlowData } from "@/types/campaigns";

export default async function EditWACampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [campaignRes, funnelsResult, membersResult, sourcesResult, waCampaignsResult, emailCampaignsResult, unifiedCampaignsResult] =
    await Promise.all([
      supabase.from("wa_campaigns").select("*").eq("id", id).single(),
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
        .eq("is_customer", false)
        .is("deleted_at", null)
        .not("source", "is", null),
      supabase.from("wa_campaigns").select("id, name, type").order("name"),
      supabase.from("email_campaigns").select("id, name, type").order("name"),
      supabase.from("unified_campaigns").select("id, name, type").order("name"),
    ]);

  if (campaignRes.error || !campaignRes.data) {
    notFound();
  }

  const campaign = campaignRes.data;

  const funnels = (funnelsResult.data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
  }));

  type Stage = { id: string; name: string; funnel_id: string; order: number };
  const allStages: Stage[] = (funnelsResult.data ?? []).flatMap((f) =>
    ((f.funnel_stages ?? []) as Stage[]).map((s) => ({
      id: s.id,
      name: s.name,
      funnel_id: s.funnel_id,
      order: s.order,
    }))
  );
  const stagesList = Array.from(
    new Map(allStages.map((s) => [s.name, s] as const)).values()
  );

  const teamMembers = (membersResult.data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
  }));

  const sources = [
    ...new Set(
      (sourcesResult.data ?? [])
        .map((c) => c.source as string)
        .filter(Boolean)
    ),
  ].sort();

  const initialData = {
    id: campaign.id,
    name: campaign.name,
    type: campaign.type as "one_time" | "drip" | "newsletter",
    audience_filter: (campaign.audience_filter as AudienceFilter) ?? null,
    flow_data: (campaign.flow_data as FlowData) ?? null,
  };

  return (
    <>
      <SetBreadcrumb
        items={[
          { label: "WhatsApp", href: "/whatsapp" },
          { label: campaign.name, href: `/whatsapp/campaigns/${id}` },
          { label: "Edit" },
        ]}
      />
      <div className="page-enter space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/whatsapp/campaigns/${id}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Campaign
          </Link>
        </div>

        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Edit Campaign
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Update your campaign flow, audience, or messages.
          </p>
        </div>

        <CampaignWizard
          funnels={funnels}
          stages={stagesList}
          teamMembers={teamMembers}
          sources={sources}
          initialData={initialData}
          campaigns={[
            ...(waCampaignsResult.data ?? []).map((c) => ({ id: c.id, name: c.name, type: c.type ?? "whatsapp" })),
            ...(emailCampaignsResult.data ?? []).map((c) => ({ id: c.id, name: c.name, type: c.type ?? "email" })),
            ...(unifiedCampaignsResult.data ?? []).map((c) => ({ id: c.id, name: c.name, type: c.type ?? "unified" })),
          ]}
        />
      </div>
    </>
  );
}
