"use client";

import { useState, useEffect } from "react";
import { subDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { MessageCircle, Mail, Loader2 } from "lucide-react";
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

const tooltipStyle = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--card))",
  fontSize: "12px",
};

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
      <p className="mt-1.5 font-mono text-xl font-bold" style={{ color }}>
        {rate.toFixed(1)}%
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
        {delivered.toLocaleString()} / {total.toLocaleString()}
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
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading communication data...
      </div>
    );
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
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-green-100 dark:bg-green-900/50">
            <MessageCircle className="size-3.5 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-sm font-semibold">WhatsApp</h3>
          <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums">
            {metrics.waSent.toLocaleString()} sent
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <RateCard label="Sent" total={metrics.waSent} delivered={metrics.waSent} rate={100} color="#22c55e" />
          <RateCard label="Delivered" total={metrics.waSent} delivered={metrics.waDelivered} rate={waDeliveryRate} color="#3B82F6" />
          <RateCard label="Read" total={metrics.waSent} delivered={metrics.waRead} rate={waReadRate} color="#8B5CF6" />
        </div>
      </div>

      {/* Email metrics */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/50">
            <Mail className="size-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold">Email</h3>
          <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums">
            {metrics.emailSent.toLocaleString()} sent
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RateCard label="Sent" total={metrics.emailSent} delivered={metrics.emailSent} rate={100} color="#22c55e" />
          <RateCard label="Delivered" total={metrics.emailSent} delivered={metrics.emailDelivered} rate={emailDeliveryRate} color="#3B82F6" />
          <RateCard label="Opened" total={metrics.emailSent} delivered={metrics.emailOpened} rate={emailOpenRate} color="#F59E0B" />
          <RateCard label="Clicked" total={metrics.emailSent} delivered={metrics.emailClicked} rate={metrics.emailSent > 0 ? (metrics.emailClicked / metrics.emailSent) * 100 : 0} color="#EF4444" />
        </div>
      </div>

      {/* Volume chart */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Daily Volume</h3>
        {data.byDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.byDay}>
              <defs>
                <linearGradient id="waLineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#16a34a" />
                </linearGradient>
                <linearGradient id="emailLineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#2563eb" />
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
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="waSent" name="WhatsApp" stroke="url(#waLineGradient)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="emailSent" name="Email" stroke="url(#emailLineGradient)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
        )}
      </div>
    </div>
  );
}
