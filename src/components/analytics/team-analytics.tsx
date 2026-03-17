"use client";

import { useState, useEffect } from "react";
import { subDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { formatCurrency } from "@/lib/utils";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TeamAnalytics } from "@/types/analytics";

export function TeamAnalyticsView() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [data, setData] = useState<TeamAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;
    setLoading(true);
    fetch(
      `/api/analytics/team?from=${format(dateRange.from, "yyyy-MM-dd")}&to=${format(dateRange.to, "yyyy-MM-dd")}`
    )
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [dateRange]);

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;
  }
  if (!data) return null;

  const chartData = data.members.map((m) => ({
    name: m.memberName.split(" ")[0],
    tasks: m.tasksCompleted,
    leads: m.leadsAssigned,
    conversions: m.conversions,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <div className="ml-auto flex gap-4 text-xs text-muted-foreground">
          <span>{data.totalTasks} tasks</span>
          <span>{data.totalLeads} leads</span>
          <span>{data.totalConversions} conversions</span>
          <span>{formatCurrency(data.totalRevenue)} revenue</span>
        </div>
      </div>

      {/* Workload chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 text-sm font-medium">Team Workload</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="tasks" name="Tasks" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="leads" name="Leads" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="conversions" name="Conversions" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Leaderboard table */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-3">
          <h3 className="text-sm font-medium">Team Leaderboard</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead className="text-right">Tasks Done</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Conversions</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  No team data
                </TableCell>
              </TableRow>
            ) : (
              data.members
                .sort((a, b) => b.revenue - a.revenue)
                .map((m) => (
                  <TableRow key={m.memberId}>
                    <TableCell className="text-sm font-medium">{m.memberName}</TableCell>
                    <TableCell className="text-right text-sm">{m.tasksCompleted}</TableCell>
                    <TableCell className="text-right text-sm">{m.leadsAssigned}</TableCell>
                    <TableCell className="text-right text-sm">{m.conversions}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(m.revenue)}
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
