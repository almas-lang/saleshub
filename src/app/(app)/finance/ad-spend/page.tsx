import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdSpendList } from "@/components/finance/ad-spend-list";
import { FinanceNav } from "@/components/finance/finance-nav";
import { format } from "date-fns";
import type { AdSpend } from "@/types/finance";
import type {
  DailySpendPoint,
  CampaignSpendPoint,
  PerformancePoint,
} from "@/components/finance/ad-spend-charts";

export default async function AdSpendPage() {
  // Default: last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

  const { data } = await supabaseAdmin
    .from("ad_spend")
    .select("*")
    .gte("date", fromDate)
    .order("date", { ascending: false })
    .limit(500);

  const adSpend = (data ?? []) as AdSpend[];

  const totalSpend = adSpend.reduce((s, a) => s + a.amount, 0);
  const totalImpressions = adSpend.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = adSpend.reduce((s, a) => s + a.clicks, 0);
  const totalLeads = adSpend.reduce((s, a) => s + a.leads, 0);

  // ── Aggregate chart data ──

  // Daily spend (grouped by date, ascending)
  const dailyMap = new Map<string, { spend: number; impressions: number; clicks: number; leads: number }>();
  for (const row of adSpend) {
    const existing = dailyMap.get(row.date);
    if (existing) {
      existing.spend += row.amount;
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.leads += row.leads;
    } else {
      dailyMap.set(row.date, {
        spend: row.amount,
        impressions: row.impressions,
        clicks: row.clicks,
        leads: row.leads,
      });
    }
  }

  const sortedDates = [...dailyMap.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const dailySpend: DailySpendPoint[] = sortedDates.map(([date, d]) => ({
    date: format(new Date(date), "dd MMM"),
    spend: d.spend,
  }));

  const performance: PerformancePoint[] = sortedDates.map(([date, d]) => ({
    date: format(new Date(date), "dd MMM"),
    cpl: d.leads > 0 ? Math.round(d.spend / d.leads) : 0,
    ctr: d.impressions > 0 ? +((d.clicks / d.impressions) * 100).toFixed(1) : 0,
  }));

  // Campaign breakdown (top 5)
  const campaignMap = new Map<string, number>();
  for (const row of adSpend) {
    campaignMap.set(
      row.campaign_name,
      (campaignMap.get(row.campaign_name) ?? 0) + row.amount
    );
  }
  const campaignBreakdown: CampaignSpendPoint[] = [...campaignMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([campaign, spend]) => ({
      campaign: campaign.length > 25 ? campaign.slice(0, 22) + "…" : campaign,
      spend,
    }));

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Finance</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Track advertising spend across platforms.
        </p>
      </div>

      <FinanceNav />

      <AdSpendList
        adSpend={adSpend}
        totalSpend={totalSpend}
        totalImpressions={totalImpressions}
        totalClicks={totalClicks}
        totalLeads={totalLeads}
        dailySpend={dailySpend}
        campaignBreakdown={campaignBreakdown}
        performance={performance}
      />
    </div>
  );
}
