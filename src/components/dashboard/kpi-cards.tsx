"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useCountUp } from "@/hooks/use-count-up";
import type { KpiData } from "@/types/dashboard";

function trendPercent(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

interface KpiCardProps {
  label: string;
  value: number;
  format?: "number" | "currency";
  subtext: string;
  trend: number;
  trendLabel: string;
  danger?: boolean;
  index: number;
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
}: KpiCardProps) {
  const animated = useCountUp(value);
  const isPositive = trend > 0;
  const isNeutral = trend === 0;
  const isZero = value === 0;

  const displayValue =
    fmt === "currency" ? formatCurrency(animated) : animated.toString();

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 transition-shadow duration-[180ms]",
        "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)]",
        "hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06),0_2px_4px_-1px_rgba(0,0,0,0.04)]",
        danger && "border-l-[3px] border-l-destructive"
      )}
      style={{
        animation: `fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms both`,
      }}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
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
    </div>
  );
}

export function KpiCards({ data }: { data: KpiData }) {
  const leadsTrend = trendPercent(data.newLeads, data.newLeadsLastWeek);
  const followUpsTrend = trendPercent(
    data.followUps,
    data.followUpsLastWeek
  );
  const revenueTrend = trendPercent(data.revenue, data.revenueLastMonth);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <KpiCard
        label="New leads"
        value={data.newLeads}
        subtext="this week"
        trend={leadsTrend}
        trendLabel="vs last week"
        index={0}
      />
      <KpiCard
        label="Follow-ups"
        value={data.followUps}
        subtext="due within 3 days"
        trend={followUpsTrend}
        trendLabel="vs last week"
        index={1}
      />
      <KpiCard
        label="Revenue"
        value={data.revenue}
        format="currency"
        subtext="this month"
        trend={revenueTrend}
        trendLabel="vs last month"
        index={2}
      />
      <KpiCard
        label="Overdue"
        value={data.overdueTasks}
        subtext={data.overdueTasks === 1 ? "task needs attention" : "tasks need attention"}
        trend={data.overdueTasks > 0 ? -data.overdueTasks : 0}
        trendLabel={data.overdueTasks > 0 ? "overdue" : ""}
        danger={data.overdueTasks > 0}
        index={3}
      />
    </div>
  );
}
