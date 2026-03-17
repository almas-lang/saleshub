"use client";

import { formatCurrency } from "@/lib/utils";
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import type { AnalyticsOverview } from "@/types/analytics";

function MiniSparkline({ data, color }: { data: { value: number }[]; color: string }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface AnalyticsOverviewCardProps {
  label: string;
  value: string;
  sparkline: { value: number }[];
  color: string;
}

function OverviewCard({ label, value, sparkline, color }: AnalyticsOverviewCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold">{value}</p>
      <div className="mt-2">
        <MiniSparkline data={sparkline} color={color} />
      </div>
    </div>
  );
}

interface AnalyticsOverviewViewProps {
  data: AnalyticsOverview;
}

export function AnalyticsOverviewView({ data }: AnalyticsOverviewViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <OverviewCard
        label="Total Leads"
        value={data.totalLeads.toString()}
        sparkline={data.leadsTrend}
        color="#3B82F6"
      />
      <OverviewCard
        label="Conversion Rate"
        value={`${data.conversionRate.toFixed(1)}%`}
        sparkline={data.conversionTrend}
        color="#8B5CF6"
      />
      <OverviewCard
        label="Revenue"
        value={formatCurrency(data.totalRevenue)}
        sparkline={data.revenueTrend}
        color="#22c55e"
      />
      <OverviewCard
        label="Avg Deal Size"
        value={formatCurrency(data.avgDealSize)}
        sparkline={data.dealSizeTrend}
        color="#F59E0B"
      />
    </div>
  );
}
