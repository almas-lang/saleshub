"use client";

import { useState, useEffect } from "react";
import { subDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { DateRangePicker } from "@/components/shared/date-range-picker";
import type { CommunicationAnalytics } from "@/types/analytics";

function RateCard({
  label,
  total,
  delivered,
  rate,
  color,
}: {
  label: string;
  total: number;
  delivered: number;
  rate: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-bold" style={{ color }}>
        {rate.toFixed(1)}%
      </p>
      <p className="text-xs text-muted-foreground">
        {delivered} / {total}
      </p>
    </div>
  );
}

export function CommunicationAnalyticsView() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [data, setData] = useState<CommunicationAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;
    setLoading(true);
    fetch(
      `/api/analytics/communication?from=${format(dateRange.from, "yyyy-MM-dd")}&to=${format(dateRange.to, "yyyy-MM-dd")}`
    )
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [dateRange]);

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;
  }
  if (!data) return null;

  const { metrics } = data;
  const waDeliveryRate = metrics.waSent > 0 ? (metrics.waDelivered / metrics.waSent) * 100 : 0;
  const waReadRate = metrics.waSent > 0 ? (metrics.waRead / metrics.waSent) * 100 : 0;
  const emailDeliveryRate = metrics.emailSent > 0 ? (metrics.emailDelivered / metrics.emailSent) * 100 : 0;
  const emailOpenRate = metrics.emailSent > 0 ? (metrics.emailOpened / metrics.emailSent) * 100 : 0;

  return (
    <div className="space-y-6">
      <DateRangePicker value={dateRange} onChange={setDateRange} />

      {/* WhatsApp metrics */}
      <div>
        <h3 className="mb-3 text-sm font-medium">WhatsApp</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RateCard label="Sent" total={metrics.waSent} delivered={metrics.waSent} rate={100} color="#22c55e" />
          <RateCard label="Delivered" total={metrics.waSent} delivered={metrics.waDelivered} rate={waDeliveryRate} color="#3B82F6" />
          <RateCard label="Read" total={metrics.waSent} delivered={metrics.waRead} rate={waReadRate} color="#8B5CF6" />
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="mt-1 font-mono text-lg font-bold">{metrics.waSent}</p>
          </div>
        </div>
      </div>

      {/* Email metrics */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Email</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RateCard label="Sent" total={metrics.emailSent} delivered={metrics.emailSent} rate={100} color="#22c55e" />
          <RateCard label="Delivered" total={metrics.emailSent} delivered={metrics.emailDelivered} rate={emailDeliveryRate} color="#3B82F6" />
          <RateCard label="Opened" total={metrics.emailSent} delivered={metrics.emailOpened} rate={emailOpenRate} color="#F59E0B" />
          <RateCard label="Clicked" total={metrics.emailSent} delivered={metrics.emailClicked} rate={metrics.emailSent > 0 ? (metrics.emailClicked / metrics.emailSent) * 100 : 0} color="#EF4444" />
        </div>
      </div>

      {/* Volume chart */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 text-sm font-medium">Daily Volume</h3>
        {data.byDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.byDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(d) => format(new Date(d), "dd/MM")}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(d) => format(new Date(d), "dd MMM yyyy")}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="waSent" name="WhatsApp" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="emailSent" name="Email" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
        )}
      </div>
    </div>
  );
}
