import { createClient } from "@/lib/supabase/server";
import { subDays, format } from "date-fns";
import { getAnalyticsOverview } from "@/lib/analytics/queries";
import { AnalyticsPageClient } from "./client";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const from = format(subDays(new Date(), 29), "yyyy-MM-dd");
  const to = format(new Date(), "yyyy-MM-dd");

  const [overview, funnelsRes] = await Promise.all([
    getAnalyticsOverview(from, to),
    supabase
      .from("funnels")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
  ]);

  const funnels = (funnelsRes.data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
  }));

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Insights across leads, pipeline, communication, and team performance.
        </p>
      </div>

      <AnalyticsPageClient overview={overview} funnels={funnels} />
    </div>
  );
}
