"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GitBranch, ArrowRight } from "lucide-react";
import type { PipelineStageData, PipelineFunnel } from "@/types/dashboard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";

export function PipelineOverview({
  stages: allStages,
  funnels,
}: {
  stages: PipelineStageData[];
  funnels: PipelineFunnel[];
}) {
  const router = useRouter();
  const [selectedFunnel, setSelectedFunnel] = useState("all");

  const stages =
    selectedFunnel === "all"
      ? allStages.filter((s) => s.count > 0)
      : allStages.filter((s) => s.funnel_id === selectedFunnel && s.count > 0);

  const total = stages.reduce((sum, s) => sum + s.count, 0);

  if (stages.length === 0 || total === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold">Pipeline health</CardTitle>
          {funnels.length > 1 && (
            <Select value={selectedFunnel} onValueChange={setSelectedFunnel}>
              <SelectTrigger className="h-7 w-auto gap-1 border-none bg-transparent px-2 text-xs text-muted-foreground shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">All funnels</SelectItem>
                {funnels.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={GitBranch}
            title="No pipeline data"
            description="Assign prospects to funnels to see your pipeline breakdown."
          />
        </CardContent>
      </Card>
    );
  }

  // Calculate conversion
  const firstStageCount = stages[0]?.count ?? 0;
  const lastStageCount = stages[stages.length - 1]?.count ?? 0;
  const convPct =
    firstStageCount > 0
      ? Math.round((lastStageCount / firstStageCount) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Pipeline health</CardTitle>
        {funnels.length > 1 && (
          <Select value={selectedFunnel} onValueChange={setSelectedFunnel}>
            <SelectTrigger className="h-7 w-auto gap-1 border-none bg-transparent px-2 text-xs text-muted-foreground shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All funnels</SelectItem>
              {funnels.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={200}>
          {/* Horizontal bars per stage */}
          <div className="space-y-2">
            {stages.map((stage) => {
              const pct = (stage.count / total) * 100;
              return (
                <Tooltip key={stage.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-md px-1 py-0.5 text-left transition-colors duration-100 hover:bg-accent"
                      onClick={() =>
                        router.push(`/prospects?stage_id=${stage.id}`)
                      }
                    >
                      <span className="w-28 shrink-0 truncate text-right text-xs text-muted-foreground" title={stage.name}>
                        {stage.name}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(pct, 2)}%`,
                            backgroundColor: stage.color,
                          }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-xs text-foreground">
                        {stage.count}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{stage.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {stage.count} contacts ({Math.round(pct)}%)
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Conversion stats + View all */}
        <div className="mt-4 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
          <span>
            Conversion: {firstStageCount} &rarr; {lastStageCount} (
            <span
              className={
                convPct > 15
                  ? "font-medium text-emerald-600"
                  : convPct >= 5
                    ? "font-medium text-amber-500"
                    : "font-medium text-destructive"
              }
            >
              {convPct}%
            </span>
            )
          </span>
          <Link
            href="/funnels"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            View all funnels
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
