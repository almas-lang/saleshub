import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "@/components/prospects/import/import-wizard";

export default async function ImportPage() {
  const supabase = await createClient();

  const [funnelsResult, membersResult] = await Promise.all([
    supabase
      .from("funnels")
      .select("id, name, funnel_stages(id, name, color, funnel_id, order)")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("team_members")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
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
        color: string;
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

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/prospects"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Prospects
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Import Prospects
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Upload a CSV or Excel file to bulk-import prospects.
        </p>
      </div>

      <ImportWizard
        funnels={funnels}
        stages={stages}
        teamMembers={teamMembers}
      />
    </div>
  );
}
