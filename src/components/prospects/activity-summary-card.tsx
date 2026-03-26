"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ActivitySummaryProps {
  totalInteractions: number;
  daysInPipeline: number;
  emailOpenRate: number | null;
  lastContactDate: string | null;
}

export function ActivitySummaryCard({
  totalInteractions,
  daysInPipeline,
  emailOpenRate,
  lastContactDate,
}: ActivitySummaryProps) {
  // Color code the last contact date
  const { lastContactColor, lastContactText } = useMemo(() => {
    let color = "text-muted-foreground";
    let text = "Never";
    if (lastContactDate) {
      const daysSince = Math.floor(
        (Date.now() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince <= 3) {
        color = "text-emerald-600";
        text = daysSince === 0 ? "Today" : `${daysSince}d ago`;
      } else if (daysSince <= 7) {
        color = "text-amber-600";
        text = `${daysSince}d ago`;
      } else {
        color = "text-destructive";
        text = `${daysSince}d ago`;
      }
    }
    return { lastContactColor: color, lastContactText: text };
  }, [lastContactDate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Activity Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Interactions</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {totalInteractions}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Days in Pipeline</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {daysInPipeline}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email Open Rate</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {emailOpenRate !== null ? `${emailOpenRate}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Contact</p>
            <p
              suppressHydrationWarning
              className={cn(
                "mt-0.5 text-lg font-semibold",
                lastContactColor
              )}
            >
              {lastContactText}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
