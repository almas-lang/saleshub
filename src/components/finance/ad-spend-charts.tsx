"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

/* ── Types ── */

export interface DailySpendPoint {
  date: string; // "dd MMM"
  spend: number;
}

export interface CampaignSpendPoint {
  campaign: string;
  spend: number;
}

export interface PerformancePoint {
  date: string; // "dd MMM"
  cpl: number;
  ctr: number;
}

interface AdSpendChartsProps {
  dailySpend: DailySpendPoint[];
  campaignBreakdown: CampaignSpendPoint[];
  performance: PerformancePoint[];
}

const tooltipStyle = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--card))",
  fontSize: "12px",
};

const EMPTY = (
  <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
    No data for this period
  </div>
);

/* ── Component ── */

export function AdSpendCharts({
  dailySpend,
  campaignBreakdown,
  performance,
}: AdSpendChartsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Daily Spend Trend */}
      <div className="rounded-xl border bg-card p-4 lg:col-span-2">
        <h3 className="mb-3 text-sm font-medium">Daily Spend Trend</h3>
        {dailySpend.length === 0 ? (
          EMPTY
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart
              data={dailySpend}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                className="text-xs"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={tooltipStyle}
              />
              <Area
                type="monotone"
                dataKey="spend"
                name="Spend"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Campaign Breakdown */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium">Top Campaigns by Spend</h3>
        {campaignBreakdown.length === 0 ? (
          EMPTY
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={campaignBreakdown}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                className="text-xs"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="campaign"
                className="text-xs"
                tick={{ fontSize: 10 }}
                width={120}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={tooltipStyle}
              />
              <Bar
                dataKey="spend"
                name="Spend"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Performance Metrics (CPL + CTR) */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium">CPL &amp; CTR Trends</h3>
        {performance.length === 0 ? (
          EMPTY
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={performance}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                yAxisId="cpl"
                className="text-xs"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `₹${v}`}
              />
              <YAxis
                yAxisId="ctr"
                orientation="right"
                className="text-xs"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value, name) =>
                  name === "CPL"
                    ? formatCurrency(Number(value))
                    : `${Number(value).toFixed(1)}%`
                }
                contentStyle={tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line
                yAxisId="cpl"
                type="monotone"
                dataKey="cpl"
                name="CPL"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="ctr"
                type="monotone"
                dataKey="ctr"
                name="CTR %"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
