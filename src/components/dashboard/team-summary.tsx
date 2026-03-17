"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { TeamSummaryItem } from "@/types/dashboard";

interface TeamSummaryProps {
  members: TeamSummaryItem[];
}

export function TeamSummary({ members }: TeamSummaryProps) {
  if (members.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Team Summary</h3>
        </div>
        <Link
          href="/analytics?tab=team"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View details
        </Link>
      </div>
      <div className="divide-y">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between px-5 py-2.5"
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
    </div>
  );
}
