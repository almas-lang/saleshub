"use client";

import Link from "next/link";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { TrendingUp, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SparklinePoint } from "@/types/dashboard";

interface RevenueTrendProps {
  data: SparklinePoint[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">
        {format(new Date(label), "dd MMM yyyy")}
      </p>
      <p className="text-sm font-semibold">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export function RevenueTrend({ data }: RevenueTrendProps) {
  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);
  const hasData = total > 0;

  return (
    <Card
      className="overflow-hidden"
      style={{
        animation: "fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) 300ms both",
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-emerald-600" />
          <CardTitle className="text-sm font-semibold">Revenue Trend</CardTitle>
          {hasData && (
            <span className="text-xs text-muted-foreground">
              {formatCurrency(total)} total (30d)
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" asChild>
          <Link href="/finance">
            View details
            <ArrowRight className="ml-1 size-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(d) => format(new Date(d), "dd MMM")}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()
              }
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              dot={false}
              activeDot={{
                r: 4,
                stroke: "#22c55e",
                strokeWidth: 2,
                fill: "hsl(var(--card))",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
