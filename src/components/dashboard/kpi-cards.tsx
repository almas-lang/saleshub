"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { useCountUp } from "@/hooks/use-count-up";
import { Card } from "@/components/ui/card";
import type { KpiData, SparklinePoint } from "@/types/dashboard";

function trendPercent(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

interface KpiCardProps {
  label: string;
  value: number;
  format?: "number" | "currency" | "percent";
  subtext: string;
  trend: number;
  trendLabel: string;
  danger?: boolean;
  index: number;
  sparkline?: SparklinePoint[];
  sparkColor?: string;
  href: string;
}

function KpiCard({
  label,
  value,
  format: fmt = "number",
  subtext,
  trend,
  trendLabel,
  danger,
  index,
  sparkline,
  sparkColor = "#3B82F6",
  href,
}: KpiCardProps) {
  const animated = useCountUp(value);
  const isPositive = trend > 0;
  const isNeutral = trend === 0;
  const isZero = value === 0;

  const displayValue =
    fmt === "currency"
      ? formatCurrency(animated)
      : fmt === "percent"
        ? `${animated}%`
        : animated.toString();

  return (
    <Link href={href} className="group block">
      <Card
        className={cn(
          "relative overflow-hidden p-5 transition-all duration-200",
          "hover:shadow-md hover:border-primary/20",
          "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2",
          danger && "border-l-[3px] border-l-destructive"
        )}
        style={{
          animation: `fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms both`,
        }}
      >
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <ChevronRight className="size-3.5 text-muted-foreground/0 transition-all duration-200 group-hover:text-muted-foreground group-hover:translate-x-0.5" />
        </div>
        <p
          className={cn(
            "mt-1 font-mono text-2xl tracking-tight",
            isZero
              ? "font-normal text-muted-foreground"
              : "font-bold text-foreground",
            danger && !isZero && "text-destructive"
          )}
        >
          {displayValue}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>
        {sparkline && sparkline.length > 1 && (
          <div className="mt-2">
            <ResponsiveContainer width="100%" height={30}>
              <LineChart data={sparkline}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={sparkColor}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {trendLabel && (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs font-medium",
              isNeutral && "text-muted-foreground",
              isPositive && "text-emerald-600",
              !isPositive && !isNeutral && "text-destructive"
            )}
          >
            {isNeutral ? (
              <Minus className="size-3" />
            ) : isPositive ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            {isPositive ? "+" : ""}
            {trend}% {trendLabel}
          </p>
        )}
      </Card>
    </Link>
  );
}

export function KpiCards({ data }: { data: KpiData }) {
  const leadsTrend = trendPercent(data.newLeads, data.newLeadsLastWeek);
  const followUpsTrend = trendPercent(
    data.followUps,
    data.followUpsLastWeek
  );
  const revenueTrend = trendPercent(data.revenue, data.revenueLastMonth);
  const conversionTrend = trendPercent(
    data.conversionRate,
    data.conversionRateLastMonth
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="New leads"
        value={data.newLeads}
        subtext="this week"
        trend={leadsTrend}
        trendLabel="vs last week"
        index={0}
        href="/prospects"
      />
      <KpiCard
        label="Follow-ups"
        value={data.followUps}
        subtext="due within 3 days"
        trend={followUpsTrend}
        trendLabel="vs last week"
        index={1}
        href="/tasks"
      />
      <KpiCard
        label="Revenue"
        value={data.revenue}
        format="currency"
        subtext="this month"
        trend={revenueTrend}
        trendLabel="vs last month"
        index={2}
        sparkline={data.revenueSparkline}
        sparkColor="#22c55e"
        href="/finance"
      />
      <KpiCard
        label="Conversion"
        value={data.conversionRate}
        format="percent"
        subtext="this month"
        trend={conversionTrend}
        trendLabel="vs last month"
        index={3}
        href="/analytics"
      />
      <KpiCard
        label="Overdue"
        value={data.overdueTasks}
        subtext={data.overdueTasks === 1 ? "task needs attention" : "tasks need attention"}
        trend={data.overdueTasks > 0 ? -data.overdueTasks : 0}
        trendLabel={data.overdueTasks > 0 ? "overdue" : ""}
        danger={data.overdueTasks > 0}
        index={4}
        href="/tasks"
      />
    </div>
  );
}
