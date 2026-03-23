"use client";

import { useState, useEffect } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
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
      <div className="flex flex-wrap items-center gap-3">
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
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5">
              <span className="text-sm font-semibold">{data.totalContacts}</span>
              <span className="text-xs text-muted-foreground">contacts</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-emerald-50/50 px-3 py-1.5 dark:bg-emerald-950/20">
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {data.overallConversion.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">overall conversion</span>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading pipeline data...
        </div>
      ) : data ? (
        <div className="space-y-1">
          {data.stages.map((stage, i) => {
            const maxCount = Math.max(...data.stages.map((s) => s.count), 1);
            const widthPct = Math.max((stage.count / maxCount) * 100, 4);
            const dropRate =
              i < data.stages.length - 1 && stage.count > 0
                ? ((data.stages[i + 1].count / stage.count) * 100).toFixed(0)
                : null;

            return (
              <div key={stage.stageId}>
                <div className="rounded-xl border bg-card p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="size-3 rounded-full ring-2 ring-offset-2 ring-offset-background"
                        style={{ backgroundColor: stage.stageColor, ["--tw-ring-color" as string]: stage.stageColor + "40" }}
                      />
                      <span className="text-sm font-semibold">{stage.stageName}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
                        {stage.count} contacts
                      </span>
                      <span className="text-xs font-medium tabular-nums" style={{ color: stage.stageColor }}>
                        {stage.conversionRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: stage.stageColor,
                      }}
                    />
                  </div>
                </div>

                {/* Drop-off indicator between stages */}
                {dropRate && (
                  <div className="flex items-center justify-center gap-1.5 py-1">
                    <ArrowDown className="size-3 text-muted-foreground/60" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {dropRate}% proceed
                    </span>
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
