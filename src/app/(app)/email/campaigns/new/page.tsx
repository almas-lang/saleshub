import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmailCampaignWizard } from "@/components/communication/email-campaign-wizard";

export default async function NewEmailCampaignPage() {
  const supabase = await createClient();

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

  const funnels = (funnelsResult.data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
  }));

  const stages = (funnelsResult.data ?? []).flatMap((f) =>
    (
      (f.funnel_stages ?? []) as {
        id: string;
        name: string;
        funnel_id: string;
        order: number;
      }[]
    ).map((s) => ({
      id: s.id,
      name: s.name,
      funnel_id: s.funnel_id,
      order: s.order,
    }))
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

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/email"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Campaigns
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          New Email Campaign
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Create an email campaign to reach your prospects.
        </p>
      </div>

      <EmailCampaignWizard
        funnels={funnels}
        stages={stages}
        teamMembers={teamMembers}
        sources={sources}
      />
    </div>
  );
}
