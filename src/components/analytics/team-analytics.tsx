"use client";

import { useState, useEffect } from "react";
import { subDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CheckSquare, Users, Target, IndianRupee, Loader2, Trophy } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

import { formatCurrency } from "@/lib/utils";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { TeamAnalytics } from "@/types/analytics";

const tooltipStyle = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--card))",
  fontSize: "12px",
};

function StatCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof CheckSquare;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className="flex size-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: color + "18" }}
        >
          <Icon className="size-4" style={{ color }} />
        </div>
        <div>
          <p className="font-mono text-lg font-bold leading-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

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
    fetch(`/api/analytics/team?from=${format(dateRange.from, "yyyy-MM-dd")}&to=${format(dateRange.to, "yyyy-MM-dd")}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading team data...
      </div>
    );
  }
  if (!data) return null;

  const chartData = data.members.map((m) => ({
    name: m.memberName.split(" ")[0],
    tasks: m.tasksCompleted,
    leads: m.leadsAssigned,
    conversions: m.conversions,
  }));

  const sortedMembers = [...data.members].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      <DateRangePicker value={dateRange} onChange={setDateRange} />

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={CheckSquare} value={data.totalTasks.toString()} label="Tasks completed" color="#3B82F6" />
        <StatCard icon={Users} value={data.totalLeads.toString()} label="Leads assigned" color="#22c55e" />
        <StatCard icon={Target} value={data.totalConversions.toString()} label="Conversions" color="#8B5CF6" />
        <StatCard icon={IndianRupee} value={formatCurrency(data.totalRevenue)} label="Revenue" color="#F59E0B" />
      </div>

      {/* Workload chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Team Workload</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="tasks" name="Tasks" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="leads" name="Leads" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversions" name="Conversions" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="size-4 text-amber-500" />
            Team Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Conversions</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    No team data
                  </TableCell>
                </TableRow>
              ) : (
                sortedMembers.map((m, i) => (
                  <TableRow key={m.memberId} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      {i === 0 ? (
                        <Badge className="size-6 justify-center bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/50 dark:text-amber-400">
                          1
                        </Badge>
                      ) : i === 1 ? (
                        <Badge className="size-6 justify-center bg-slate-100 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400">
                          2
                        </Badge>
                      ) : i === 2 ? (
                        <Badge className="size-6 justify-center bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/50 dark:text-orange-400">
                          3
                        </Badge>
                      ) : (
                        <span className="pl-2 text-xs text-muted-foreground">{i + 1}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{m.memberName}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{m.tasksCompleted}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{m.leadsAssigned}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{m.conversions}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium tabular-nums">
                      {formatCurrency(m.revenue)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
