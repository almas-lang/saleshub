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
  Legend,
} from "recharts";

import { formatCurrency } from "@/lib/utils";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { ExportDropdown } from "@/components/shared/export-dropdown";
import { useExport } from "@/hooks/use-export";
import type { PnLReport } from "@/types/finance";

export function PnLReportView() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 89),
    to: new Date(),
  });
  const [report, setReport] = useState<PnLReport | null>(null);
  const [loading, setLoading] = useState(true);

  const { exportData, loading: exporting } = useExport({
    type: "pnl",
    filters: {
      ...(dateRange?.from && { from: format(dateRange.from, "yyyy-MM-dd") }),
      ...(dateRange?.to && { to: format(dateRange.to, "yyyy-MM-dd") }),
    },
  });

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;

    setLoading(true);
    fetch(
      `/api/finance/reports/pnl?from=${format(dateRange.from, "yyyy-MM-dd")}&to=${format(dateRange.to, "yyyy-MM-dd")}`
    )
      .then((r) => r.json())
      .then(setReport)
      .finally(() => setLoading(false));
  }, [dateRange]);

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  if (!report) return null;

  const chartData = [
    ...report.income.map((i) => ({
      category: i.category,
      income: i.amount,
      expense: 0,
    })),
    ...report.expenses.map((e) => ({
      category: e.category,
      income: 0,
      expense: e.amount,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <ExportDropdown onExport={exportData} loading={exporting} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Total Income
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-600">
            {formatCurrency(report.totalIncome)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Total Expenses
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-red-500">
            {formatCurrency(report.totalExpenses)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Net Profit
          </p>
          <p
            className={`mt-1 font-mono text-xl font-bold ${report.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}
          >
            {formatCurrency(report.netProfit)}
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 text-sm font-medium">Income by Category</h3>
          <div className="space-y-2">
            {report.income.length === 0 ? (
              <p className="text-sm text-muted-foreground">No income data</p>
            ) : (
              report.income.map((i) => (
                <div key={i.category} className="flex items-center justify-between">
                  <span className="text-sm">{i.category}</span>
                  <span className="font-mono text-sm font-medium text-emerald-600">
                    {formatCurrency(i.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 text-sm font-medium">Expenses by Category</h3>
          <div className="space-y-2">
            {report.expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expense data</p>
            ) : (
              report.expenses.map((e) => (
                <div key={e.category} className="flex items-center justify-between">
                  <span className="text-sm">{e.category}</span>
                  <span className="font-mono text-sm font-medium text-red-500">
                    {formatCurrency(e.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 text-sm font-medium">Income vs Expenses by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
