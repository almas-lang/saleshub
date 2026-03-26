"use client";

import { useState, useEffect } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PipelineAnalytics } from "@/types/analytics";

interface PipelineAnalyticsViewProps {
  funnels: { id: string; name: string }[];
}

export function PipelineAnalyticsView({ funnels }: PipelineAnalyticsViewProps) {
  const [selectedFunnel, setSelectedFunnel] = useState(funnels[0]?.id ?? "");
  const [data, setData] = useState<PipelineAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const handleFunnelChange = (funnelId: string) => {
    setSelectedFunnel(funnelId);
    setLoading(true);
  };

  useEffect(() => {
    if (!selectedFunnel) return;
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
        <Select value={selectedFunnel} onValueChange={handleFunnelChange}>
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
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 px-3 py-1.5 tabular-nums">
              <span className="font-semibold">{data.totalContacts}</span>
              <span className="font-normal text-muted-foreground">contacts</span>
            </Badge>
            <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="font-semibold">{data.overallConversion.toFixed(1)}%</span>
              <span className="font-normal text-muted-foreground">overall conversion</span>
            </Badge>
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
                <Card className="transition-colors hover:bg-muted/30">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: stage.stageColor }}
                        />
                        <span className="text-sm font-semibold">{stage.stageName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="tabular-nums">
                          {stage.count} contacts
                        </Badge>
                        <span
                          className="text-xs font-semibold tabular-nums"
                          style={{ color: stage.stageColor }}
                        >
                          {stage.conversionRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${widthPct}%`, backgroundColor: stage.stageColor }}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Drop-off indicator */}
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
