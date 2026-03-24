"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Plus, Download } from "lucide-react";
import { DateRangePicker } from "@/components/shared/date-range-picker";

import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportDropdown } from "@/components/shared/export-dropdown";
import { AdSpendForm } from "./ad-spend-form";
import { MetaImportDialog } from "./meta-import-dialog";
import {
  AdSpendCharts,
  type DailySpendPoint,
  type CampaignSpendPoint,
  type PerformancePoint,
} from "./ad-spend-charts";
import { useExport } from "@/hooks/use-export";
import type { AdSpend } from "@/types/finance";

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta",
  google: "Google",
  linkedin: "LinkedIn",
  manual: "Manual",
};

const PLATFORM_COLORS: Record<string, string> = {
  meta: "text-blue-600 bg-blue-50",
  google: "text-green-600 bg-green-50",
  linkedin: "text-sky-600 bg-sky-50",
  manual: "text-gray-600 bg-gray-50",
};

interface AdSpendListProps {
  adSpend: AdSpend[];
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalLeads: number;
  dailySpend: DailySpendPoint[];
  campaignBreakdown: CampaignSpendPoint[];
  performance: PerformancePoint[];
  initialFrom: string;
  initialTo: string;
}

export function AdSpendList({
  adSpend,
  dailySpend,
  campaignBreakdown,
  performance,
  initialFrom,
  initialTo,
}: AdSpendListProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [showMetaImport, setShowMetaImport] = useState(false);
  const [platform, setPlatform] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: parseISO(initialFrom),
    to: parseISO(initialTo),
  });

  function handleDateChange(range: DateRange | undefined) {
    setDateRange(range);
    if (range?.from && range?.to) {
      const from = format(range.from, "yyyy-MM-dd");
      const to = format(range.to, "yyyy-MM-dd");
      router.push(`/finance/ad-spend?from=${from}&to=${to}`);
    }
  }

  const { exportData, loading: exporting } = useExport({
    type: "ad_spend",
    filters: platform !== "all" ? { platform } : {},
  });

  const filtered = useMemo(
    () =>
      platform === "all"
        ? adSpend
        : adSpend.filter((a) => a.platform === platform),
    [adSpend, platform]
  );

  // Recalculate KPIs from filtered data
  const { totalSpend, totalImpressions, totalClicks, totalLeads } =
    useMemo(() => {
      const spend = filtered.reduce((s, a) => s + a.amount, 0);
      const impressions = filtered.reduce((s, a) => s + a.impressions, 0);
      const clicks = filtered.reduce((s, a) => s + a.clicks, 0);
      const leads = filtered.reduce((s, a) => s + a.leads, 0);
      return {
        totalSpend: spend,
        totalImpressions: impressions,
        totalClicks: clicks,
        totalLeads: leads,
      };
    }, [filtered]);

  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const ctr =
    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // Recalculate chart data when platform filter is active
  const chartData = useMemo(() => {
    if (platform === "all") {
      return { dailySpend, campaignBreakdown, performance };
    }

    // Rebuild from filtered rows
    const dailyMap = new Map<
      string,
      { spend: number; impressions: number; clicks: number; leads: number }
    >();
    for (const row of filtered) {
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

    const sorted = [...dailyMap.entries()].sort(([a], [b]) =>
      a.localeCompare(b)
    );

    const filteredDaily: DailySpendPoint[] = sorted.map(([date, d]) => ({
      date: format(new Date(date), "dd MMM"),
      spend: d.spend,
    }));

    const filteredPerf: PerformancePoint[] = sorted.map(([date, d]) => ({
      date: format(new Date(date), "dd MMM"),
      cpl: d.leads > 0 ? Math.round(d.spend / d.leads) : 0,
      ctr:
        d.impressions > 0
          ? +((d.clicks / d.impressions) * 100).toFixed(1)
          : 0,
    }));

    const cMap = new Map<string, number>();
    for (const row of filtered) {
      cMap.set(row.campaign_name, (cMap.get(row.campaign_name) ?? 0) + row.amount);
    }
    const filteredCampaigns: CampaignSpendPoint[] = [...cMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([campaign, spend]) => ({
        campaign:
          campaign.length > 25 ? campaign.slice(0, 22) + "…" : campaign,
        spend,
      }));

    return {
      dailySpend: filteredDaily,
      campaignBreakdown: filteredCampaigns,
      performance: filteredPerf,
    };
  }, [platform, filtered, dailySpend, campaignBreakdown, performance]);

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Total Spend
          </p>
          <p className="mt-1 font-mono text-lg font-bold">
            {formatCurrency(totalSpend)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Impressions
          </p>
          <p className="mt-1 font-mono text-lg font-bold">
            {totalImpressions.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Clicks
          </p>
          <p className="mt-1 font-mono text-lg font-bold">
            {totalClicks.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Leads
          </p>
          <p className="mt-1 font-mono text-lg font-bold">{totalLeads}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            CPL / CTR
          </p>
          <p className="mt-1 font-mono text-lg font-bold">
            {formatCurrency(cpl)} / {ctr.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={platform} onValueChange={setPlatform} className="flex-1">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="meta">Meta</TabsTrigger>
            <TabsTrigger value="google">Google</TabsTrigger>
            <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>
        </Tabs>
        <DateRangePicker value={dateRange} onChange={handleDateChange} />
        <ExportDropdown onExport={exportData} loading={exporting} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMetaImport(true)}
        >
          <Download className="mr-1 size-4" />
          Meta Import
        </Button>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 size-4" />
          Add Entry
        </Button>
      </div>

      {/* Charts */}
      <AdSpendCharts
        dailySpend={chartData.dailySpend}
        campaignBreakdown={chartData.campaignBreakdown}
        performance={chartData.performance}
      />

      {/* Table */}
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Impressions</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">CPL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No ad spend data
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">
                    {format(new Date(a.date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium",
                        PLATFORM_COLORS[a.platform] ?? "text-gray-600 bg-gray-50"
                      )}
                    >
                      {PLATFORM_LABELS[a.platform] ?? a.platform}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {a.campaign_name}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(a.amount)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {a.impressions.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {a.clicks.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {a.leads}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {a.leads > 0
                      ? formatCurrency(a.amount / a.leads)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <AdSpendForm open={showForm} onOpenChange={setShowForm} />
      <MetaImportDialog open={showMetaImport} onOpenChange={setShowMetaImport} />
    </div>
  );
}
