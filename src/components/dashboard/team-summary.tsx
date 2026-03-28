"use client";

import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TeamSummaryItem } from "@/types/dashboard";

interface TeamSummaryProps {
  members: TeamSummaryItem[];
}

export function TeamSummary({ members }: TeamSummaryProps) {
  if (members.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Team Summary</CardTitle>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" asChild>
          <Link href="/analytics?tab=team">
            View details
            <ArrowRight className="ml-1 size-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/60">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">
                  {m.tasksCompleted} tasks · {m.leadsAssigned} leads
                </p>
              </div>
              <p className="font-mono text-xs font-medium text-emerald-600">
                {formatCurrency(m.revenue)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
