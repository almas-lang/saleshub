"use client";

import { formatDate, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CustomerProgram } from "@/types/customers";

interface ProgramTrackerProps {
  programs: CustomerProgram[];
}

export function ProgramTracker({ programs }: ProgramTrackerProps) {
  if (programs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No programs enrolled yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {programs.map((program) => {
        const progress =
          program.sessions_total && program.sessions_total > 0
            ? Math.round(
                ((program.sessions_completed ?? 0) / program.sessions_total) * 100
              )
            : 0;

        return (
          <Card key={program.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{program.program_name}</CardTitle>
                <Badge
                  variant="outline"
                  className={
                    program.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : program.status === "completed"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-muted text-muted-foreground"
                  }
                >
                  {program.status ?? "active"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Sessions Progress */}
              {program.sessions_total && program.sessions_total > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Sessions</span>
                    <span className="font-medium tabular-nums">
                      {program.sessions_completed ?? 0} / {program.sessions_total}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {program.start_date && (
                  <div>
                    <span className="text-muted-foreground">Start</span>
                    <p className="font-medium">{formatDate(program.start_date)}</p>
                  </div>
                )}
                {program.end_date && (
                  <div>
                    <span className="text-muted-foreground">End</span>
                    <p className="font-medium">{formatDate(program.end_date)}</p>
                  </div>
                )}
                {program.amount != null && (
                  <div>
                    <span className="text-muted-foreground">Amount</span>
                    <p className="font-medium">{formatCurrency(program.amount)}</p>
                  </div>
                )}
              </div>

              {/* Notes */}
              {program.notes && (
                <p className="text-xs text-muted-foreground border-t pt-2">
                  {program.notes}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
