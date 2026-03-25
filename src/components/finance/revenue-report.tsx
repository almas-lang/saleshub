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
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { ExportDropdown } from "@/components/shared/export-dropdown";
import { StatCard } from "@/components/shared/stat-card";
import { useExport } from "@/hooks/use-export";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RevenueData {
  byMonth: { month: string; amount: number }[];
  topCustomers: { contactName: string; amount: number }[];
  total: number;
}

function RevenueSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export function RevenueReportView() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 89),
    to: new Date(),
  });
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const { exportData, loading: exporting } = useExport({
    type: "revenue",
    filters: {
      ...(dateRange?.from && { from: format(dateRange.from, "yyyy-MM-dd") }),
      ...(dateRange?.to && { to: format(dateRange.to, "yyyy-MM-dd") }),
    },
  });

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;

    setLoading(true);
    fetch(
      `/api/finance/reports/revenue?from=${format(dateRange.from, "yyyy-MM-dd")}&to=${format(dateRange.to, "yyyy-MM-dd")}`
    )
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [dateRange]);

  if (loading) return <RevenueSkeleton />;
  if (!data) return null;

  const chartData = data.byMonth.map((d) => ({
    ...d,
    label: d.month.slice(5).replace(/^0/, "") + "/" + d.month.slice(2, 4),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <ExportDropdown onExport={exportData} loading={exporting} />
      </div>

      {/* Total */}
      <StatCard label="Total Revenue" value={data.total} color="emerald" index={0} />

      {/* Monthly chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-medium">Revenue by Month</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="amount" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top customers */}
      <div className="rounded-xl border bg-card shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        <div className="border-b px-5 py-3">
          <h3 className="text-sm font-medium">Top 10 Customers</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.topCustomers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  No data
                </TableCell>
              </TableRow>
            ) : (
              data.topCustomers.map((c, i) => (
                <TableRow key={c.contactName} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="text-sm text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {c.contactName}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium text-emerald-600">
                    {formatCurrency(c.amount)}
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
