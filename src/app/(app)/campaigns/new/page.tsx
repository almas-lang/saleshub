import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UnifiedCampaignWizard } from "@/components/communication/unified-campaign-wizard";

export default async function NewUnifiedCampaignPage() {
  const supabase = await createClient();

  const [funnelsResult, membersResult, sourcesResult, waCampaignsResult, emailCampaignsResult, unifiedCampaignsResult] = await Promise.all([
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

  const funnels = (funnelsResult.data ?? []).map((f) => ({ id: f.id, name: f.name }));

  type Stage = { id: string; name: string; funnel_id: string; order: number };
  const allStages: Stage[] = (funnelsResult.data ?? []).flatMap((f) =>
    ((f.funnel_stages ?? []) as Stage[])
      .map((s) => ({ id: s.id, name: s.name, funnel_id: s.funnel_id, order: s.order }))
  );
  const stages = Array.from(
    new Map(allStages.map((s) => [s.name, s] as const)).values()
  );

  const teamMembers = (membersResult.data ?? []).map((m) => ({ id: m.id, name: m.name }));

  const sources = [
    ...new Set(
      (sourcesResult.data ?? []).map((c) => c.source as string).filter(Boolean)
    ),
  ].sort();

  const campaigns = [
    ...(waCampaignsResult.data ?? []).map((c) => ({ id: c.id, name: c.name, type: c.type ?? "whatsapp" })),
    ...(emailCampaignsResult.data ?? []).map((c) => ({ id: c.id, name: c.name, type: c.type ?? "email" })),
    ...(unifiedCampaignsResult.data ?? []).map((c) => ({ id: c.id, name: c.name, type: c.type ?? "unified" })),
  ];

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
        <h1 className="text-xl font-semibold tracking-tight">New Unified Campaign</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Create a drip sequence mixing WhatsApp and Email in a single flow.
        </p>
      </div>

      <UnifiedCampaignWizard
        funnels={funnels}
        stages={stages}
        teamMembers={teamMembers}
        sources={sources}
        campaigns={campaigns}
      />
    </div>
  );
}
