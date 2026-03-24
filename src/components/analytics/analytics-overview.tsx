"use client";

import { Users, TrendingUp, IndianRupee, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
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
  bgClass: string;
  iconBgClass: string;
  icon: LucideIcon;
}

function OverviewCard({ label, value, sparkline, color, bgClass, iconBgClass, icon: Icon }: OverviewCardProps) {
  return (
    <Card className={bgClass}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className={`flex size-8 items-center justify-center rounded-lg ${iconBgClass}`}>
            <Icon className="size-4" style={{ color }} />
          </div>
        </div>
        <p className="mt-2 font-mono text-2xl font-bold">{value}</p>
        <div className="mt-3">
          <MiniSparkline data={sparkline} color={color} />
        </div>
      </CardContent>
    </Card>
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
        bgClass="bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/50"
        iconBgClass="bg-blue-100 dark:bg-blue-900/50"
        icon={Users}
      />
      <OverviewCard
        label="Conversion Rate"
        value={`${data.conversionRate.toFixed(1)}%`}
        sparkline={data.conversionTrend}
        color="#8B5CF6"
        bgClass="bg-violet-50/50 border-violet-100 dark:bg-violet-950/20 dark:border-violet-900/50"
        iconBgClass="bg-violet-100 dark:bg-violet-900/50"
        icon={Target}
      />
      <OverviewCard
        label="Revenue"
        value={formatCurrency(data.totalRevenue)}
        sparkline={data.revenueTrend}
        color="#22c55e"
        bgClass="bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50"
        iconBgClass="bg-emerald-100 dark:bg-emerald-900/50"
        icon={IndianRupee}
      />
      <OverviewCard
        label="Avg Deal Size"
        value={formatCurrency(data.avgDealSize)}
        sparkline={data.dealSizeTrend}
        color="#F59E0B"
        bgClass="bg-amber-50/50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/50"
        iconBgClass="bg-amber-100 dark:bg-amber-900/50"
        icon={TrendingUp}
      />
    </div>
  );
}
