import { createClient } from "@/lib/supabase/server";
import { FunnelList } from "@/components/funnels/funnel-list";

export default async function FunnelsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("funnels")
    .select("*, funnel_stages(count), contacts(count)")
    .order("created_at", { ascending: true });

  const funnels = (data ?? []).map((f) => ({
    ...f,
    stage_count: (f.funnel_stages as unknown as { count: number }[])?.[0]?.count ?? 0,
    contact_count: (f.contacts as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Funnels</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your sales pipeline templates and stages.
        </p>
      </div>
      <FunnelList funnels={funnels} />
    </div>
  );
}
