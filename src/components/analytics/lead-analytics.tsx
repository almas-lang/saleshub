"use client";

import { useState, useEffect } from "react";
import { subDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Users, TrendingUp, Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { DateRangePicker } from "@/components/shared/date-range-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeadAnalytics } from "@/types/analytics";

const tooltipStyle = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--card))",
  fontSize: "12px",
};

export function LeadAnalyticsView() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [data, setData] = useState<LeadAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;
    setLoading(true);
    fetch(
      `/api/analytics/leads?from=${format(dateRange.from, "yyyy-MM-dd")}&to=${format(dateRange.to, "yyyy-MM-dd")}`
    )
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading lead analytics...
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg border bg-blue-50/50 px-3 py-1.5 dark:bg-blue-950/20">
            <Users className="size-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold">{data.totalLeads}</span>
            <span className="text-xs text-muted-foreground">leads</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-emerald-50/50 px-3 py-1.5 dark:bg-emerald-950/20">
            <TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-semibold">{data.conversionRate.toFixed(1)}%</span>
            <span className="text-xs text-muted-foreground">conversion</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leads by source */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Leads by Source</h3>
          {data.bySource.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.bySource} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={75} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#3B82F6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
          )}
        </div>

        {/* Leads over time */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Leads Over Time</h3>
          {data.overTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.overTime}>
                <defs>
                  <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(d) => format(new Date(d), "dd/MM")}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(d) => format(new Date(d), "dd MMM yyyy")}
                  contentStyle={tooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  fill="url(#leadGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
          )}
        </div>
      </div>

      {/* UTM Campaign table */}
      {data.byCampaign.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="border-b px-5 py-3.5">
            <h3 className="text-sm font-semibold">UTM Campaigns</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Conversions</TableHead>
                <TableHead className="text-right">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byCampaign.map((c) => (
                <TableRow key={c.campaign} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="text-sm font-medium">{c.campaign}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{c.leads}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{c.conversions}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums font-medium">
                    {c.conversionRate.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
