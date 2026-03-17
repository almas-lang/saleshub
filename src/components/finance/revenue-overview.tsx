"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RevenueOverviewProps {
  byMonth: { month: string; amount: number }[];
  topCustomers: { contactName: string; amount: number }[];
  total: number;
}

export function RevenueOverview({
  byMonth,
  topCustomers,
  total,
}: RevenueOverviewProps) {
  const formatted = byMonth.map((d) => ({
    ...d,
    label: d.month.slice(5).replace(/^0/, "") + "/" + d.month.slice(2, 4),
  }));

  return (
    <div className="space-y-6">
      {/* Revenue KPI */}
      <div className="rounded-xl border bg-card p-5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Total Revenue (Paid Invoices)
        </p>
        <p className="mt-1 font-mono text-2xl font-bold text-emerald-600">
          {formatCurrency(total)}
        </p>
      </div>

      {/* Monthly line chart */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 text-sm font-medium">Revenue by Month</h3>
        {byMonth.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={formatted} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
              <Line
                type="monotone"
                dataKey="amount"
                name="Revenue"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No revenue data
          </p>
        )}
      </div>

      {/* Top customers table */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-3">
          <h3 className="text-sm font-medium">Top Customers by Revenue</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topCustomers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  No data yet
                </TableCell>
              </TableRow>
            ) : (
              topCustomers.map((c, i) => (
                <TableRow key={c.contactName}>
                  <TableCell className="text-sm text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {c.contactName}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
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
