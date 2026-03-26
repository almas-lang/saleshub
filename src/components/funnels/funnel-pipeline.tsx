"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Stage {
  id: string;
  name: string;
  color: string;
  is_terminal: boolean;
}

interface FunnelPipelineProps {
  stages: Stage[];
  contactCounts: Record<string, number>;
}

export function FunnelPipeline({ stages, contactCounts }: FunnelPipelineProps) {
  const totalContacts = Object.values(contactCounts).reduce(
    (sum, c) => sum + c,
    0
  );

  if (stages.length === 0 || totalContacts === 0) return null;

  return (
    <TooltipProvider>
      <div className="rounded-xl border bg-card p-5">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Pipeline Distribution
        </p>
        <div className="flex gap-1 overflow-hidden rounded-lg">
          {stages.map((stage) => {
            const count = contactCounts[stage.id] ?? 0;
            if (count === 0) return null;
            const pct = (count / totalContacts) * 100;

            return (
              <Tooltip key={stage.id}>
                <TooltipTrigger asChild>
                  <div
                    className="flex min-w-[40px] items-center justify-center py-2.5 text-[11px] font-medium text-white transition-all hover:opacity-90"
                    style={{
                      backgroundColor: stage.color,
                      width: `${Math.max(pct, 8)}%`,
                    }}
                  >
                    {pct >= 12 ? count : ""}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs font-medium">{stage.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {count} contact{count !== 1 ? "s" : ""} ({pct.toFixed(0)}%)
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {stages.map((stage) => {
            const count = contactCounts[stage.id] ?? 0;
            if (count === 0) return null;
            return (
              <div key={stage.id} className="flex items-center gap-1.5">
                <div
                  className="size-2 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="text-[11px] text-muted-foreground">
                  {stage.name} ({count})
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
