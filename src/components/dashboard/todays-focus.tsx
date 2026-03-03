"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Calendar,
  Sparkles,
  Users,
  ChevronRight,
  Phone,
  ArrowRight,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { TodaysFocusItem } from "@/types/dashboard";

const PRIORITY_CONFIG: Record<
  TodaysFocusItem["priority"],
  { dot: string; bg: string; label: string; icon: typeof AlertTriangle }
> = {
  overdue: { dot: "bg-destructive", bg: "bg-destructive/5", label: "Overdue", icon: AlertTriangle },
  pending: { dot: "bg-indigo-500", bg: "bg-indigo-500/5", label: "Upcoming", icon: Clock },
  today: { dot: "bg-amber-500", bg: "bg-amber-500/5", label: "Today", icon: Calendar },
  positive: { dot: "bg-emerald-500", bg: "bg-emerald-500/5", label: "Won", icon: Sparkles },
  info: { dot: "bg-blue-500", bg: "bg-blue-500/5", label: "New", icon: Users },
};

const TASK_PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const SECTION_ORDER: {
  key: TodaysFocusItem["priority"];
  label: string;
}[] = [
  { key: "overdue", label: "Overdue Tasks" },
  { key: "pending", label: "Upcoming Tasks" },
  { key: "today", label: "Bookings Today" },
  { key: "positive", label: "Recently Converted" },
  { key: "info", label: "New Leads" },
];

export function TodaysFocus({ items }: { items: TodaysFocusItem[] }) {
  const router = useRouter();

  async function handleComplete(taskId: string) {
    const result = await safeFetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "completed",
        completed_at: new Date().toISOString(),
      }),
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Task completed");
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Today&apos;s focus
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => router.push("/tasks")}
          >
            View all tasks
            <ArrowRight className="ml-1 size-3" />
          </Button>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Sparkles}
            title="All caught up!"
            description="No urgent tasks right now. Great work keeping on top of things."
          />
        </CardContent>
      </Card>
    );
  }

  const sections = SECTION_ORDER.map((s) => ({
    ...s,
    items: items.filter((item) => item.priority === s.key),
  })).filter((s) => s.items.length > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">
          Today&apos;s focus
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => router.push("/tasks")}
        >
          View all tasks
          <ArrowRight className="ml-1 size-3" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/60">
          {sections.map((section) => {
            const config = PRIORITY_CONFIG[section.key];
            const Icon = config.icon;
            return (
              <div key={section.key} className="py-3 first:pt-0 last:pb-0">
                {/* Section header */}
                <div className="mb-2 flex items-center gap-2">
                  <Icon className={cn("size-3.5", section.key === "overdue" ? "text-destructive" : "text-muted-foreground")} />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </p>
                  <span className={cn(
                    "inline-flex size-4 items-center justify-center rounded-full text-[10px] font-medium text-white",
                    config.dot
                  )}>
                    {section.items.length}
                  </span>
                </div>

                {/* Section items */}
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-100 hover:bg-accent/50"
                      onClick={() => router.push(item.linkTo)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(item.linkTo);
                        }
                      }}
                    >
                      {/* Checkbox for tasks, dot for non-tasks */}
                      {item.taskId ? (
                        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            onCheckedChange={() => handleComplete(item.taskId!)}
                            aria-label={`Complete: ${item.actionText}`}
                          />
                        </div>
                      ) : (
                        <span
                          className={cn(
                            "mt-[7px] size-2 shrink-0 rounded-full",
                            config.dot
                          )}
                        />
                      )}

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">
                          {item.actionText}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          {item.contactName && (
                            <span className="font-medium text-foreground/80">
                              {item.contactName}
                            </span>
                          )}
                          {item.stageName && (
                            <span className="flex items-center gap-1">
                              <span
                                className="inline-block size-1.5 rounded-full"
                                style={{
                                  backgroundColor: item.stageColor ?? undefined,
                                }}
                              />
                              {item.stageName}
                            </span>
                          )}
                          {item.contextDetail && (
                            <span>{item.contextDetail}</span>
                          )}
                        </div>
                      </div>

                      {/* Task priority badge */}
                      {item.taskPriority && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "mt-0.5 shrink-0 text-[10px] font-medium",
                            TASK_PRIORITY_COLORS[item.taskPriority]
                          )}
                        >
                          {item.taskPriority}
                        </Badge>
                      )}

                      {/* Phone shortcut */}
                      {item.contactPhone && (
                        <a
                          href={`https://wa.me/${item.contactPhone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                          title="WhatsApp"
                        >
                          <Phone className="size-3.5" />
                        </a>
                      )}

                      <ChevronRight className="mt-1 size-3.5 shrink-0 text-muted-foreground/40" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
