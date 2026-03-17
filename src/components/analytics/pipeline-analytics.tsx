"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PipelineAnalytics } from "@/types/analytics";

interface PipelineAnalyticsViewProps {
  funnels: { id: string; name: string }[];
}

export function PipelineAnalyticsView({ funnels }: PipelineAnalyticsViewProps) {
  const [selectedFunnel, setSelectedFunnel] = useState(funnels[0]?.id ?? "");
  const [data, setData] = useState<PipelineAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedFunnel) return;
    setLoading(true);
    fetch(`/api/analytics/pipeline?funnel_id=${selectedFunnel}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [selectedFunnel]);

  if (funnels.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No funnels configured
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Select value={selectedFunnel} onValueChange={setSelectedFunnel}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="Select funnel" />
          </SelectTrigger>
          <SelectContent>
            {funnels.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && (
          <span className="ml-auto text-sm text-muted-foreground">
            {data.totalContacts} contacts · {data.overallConversion.toFixed(1)}%
            conversion
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : data ? (
        <div className="space-y-3">
          {data.stages.map((stage, i) => {
            const maxCount = Math.max(...data.stages.map((s) => s.count), 1);
            const widthPct = (stage.count / maxCount) * 100;

            return (
              <div key={stage.stageId} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: stage.stageColor }}
                    />
                    <span className="text-sm font-medium">{stage.stageName}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{stage.count} contacts</span>
                    <span>{stage.conversionRate.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: stage.stageColor,
                    }}
                  />
                </div>
                {i < data.stages.length - 1 && (
                  <div className="mt-1 text-right text-[10px] text-muted-foreground">
                    {data.stages[i + 1].count > 0
                      ? `${((data.stages[i + 1].count / Math.max(stage.count, 1)) * 100).toFixed(0)}% proceed`
                      : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
