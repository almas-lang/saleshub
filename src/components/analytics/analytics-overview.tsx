"use client";

import { Users, TrendingUp, IndianRupee, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { AnalyticsOverview } from "@/types/analytics";
import type { LucideIcon } from "lucide-react";

function MiniSparkline({ data, color }: { data: { value: number }[]; color: string }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface OverviewCardProps {
  label: string;
  value: string;
  sparkline: { value: number }[];
  color: string;
  icon: LucideIcon;
  index: number;
}

function OverviewCard({ label, value, sparkline, color, icon: Icon, index }: OverviewCardProps) {
  return (
    <div
      className="rounded-xl border bg-card p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-shadow duration-[180ms] hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06),0_2px_4px_-1px_rgba(0,0,0,0.04)]"
      style={{
        animation: `fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms both`,
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </div>
      <p className="mt-2 font-mono text-2xl font-bold tracking-tight">{value}</p>
      <div className="mt-3">
        <MiniSparkline data={sparkline} color={color} />
      </div>
    </div>
  );
}

export function AnalyticsOverviewView({ data }: { data: AnalyticsOverview }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <OverviewCard
        label="Total Leads"
        value={data.totalLeads.toString()}
        sparkline={data.leadsTrend}
        color="#3B82F6"
        icon={Users}
        index={0}
      />
      <OverviewCard
        label="Conversion Rate"
        value={`${data.conversionRate.toFixed(1)}%`}
        sparkline={data.conversionTrend}
        color="#8B5CF6"
        icon={Target}
        index={1}
      />
      <OverviewCard
        label="Revenue"
        value={formatCurrency(data.totalRevenue)}
        sparkline={data.revenueTrend}
        color="#22c55e"
        icon={IndianRupee}
        index={2}
      />
      <OverviewCard
        label="Avg Deal Size"
        value={formatCurrency(data.avgDealSize)}
        sparkline={data.dealSizeTrend}
        color="#F59E0B"
        icon={TrendingUp}
        index={3}
      />
    </div>
  );
}
