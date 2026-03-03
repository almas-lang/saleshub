"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";

export interface TaskWithRelations {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: string;
  type: "follow_up" | "call" | "email" | "general";
  contact_id: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  created_at: string;
  contacts: { id: string; first_name: string; last_name: string | null } | null;
  team_members: { id: string; name: string } | null;
}

interface TaskListProps {
  tasks: TaskWithRelations[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  onCreateClick?: () => void;
  compact?: boolean;
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  high: { label: "High", className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  follow_up: MessageSquare,
  call: Phone,
  email: Mail,
  general: ListChecks,
};

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

function isOverdue(task: TaskWithRelations): boolean {
  if (task.status === "completed" || task.status === "cancelled") return false;
  if (!task.due_at) return false;
  return new Date(task.due_at) < new Date();
}

export function TaskList({
  tasks,
  total,
  page,
  perPage,
  totalPages,
  onCreateClick,
  compact = false,
}: TaskListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get("status") ?? "";
  const currentPriority = searchParams.get("priority") ?? "";
  const currentType = searchParams.get("type") ?? "";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      if (!("page" in updates)) {
        params.delete("page");
      }
      router.push(`/tasks?${params.toString()}`);
    },
    [router, searchParams]
  );

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

  async function handleCancel(taskId: string) {
    const result = await safeFetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Task cancelled");
    router.refresh();
  }

  async function handleReopen(taskId: string) {
    const result = await safeFetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending", completed_at: null }),
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Task reopened");
    router.refresh();
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No tasks yet"
        description={
          currentStatus || currentPriority || currentType
            ? "Try adjusting your filters."
            : "Create your first task to get started."
        }
        action={
          onCreateClick && !currentStatus
            ? { label: "New task", onClick: onCreateClick }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar — hidden in compact mode */}
      {!compact && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Status tabs */}
          <div className="flex items-center rounded-lg border p-0.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => updateParams({ status: tab.key })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  currentStatus === tab.key
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Priority filter */}
          <Select
            value={currentPriority}
            onValueChange={(v) => updateParams({ priority: v === "all" ? "" : v })}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>

          {/* Type filter */}
          <Select
            value={currentType}
            onValueChange={(v) => updateParams({ type: v === "all" ? "" : v })}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="follow_up">Follow-up</SelectItem>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Task table */}
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10" />
              <TableHead>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Task
                </span>
              </TableHead>
              {!compact && (
                <TableHead>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Type
                  </span>
                </TableHead>
              )}
              <TableHead>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Priority
                </span>
              </TableHead>
              <TableHead>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Due
                </span>
              </TableHead>
              {!compact && (
                <>
                  <TableHead>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Contact
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Assigned to
                    </span>
                  </TableHead>
                </>
              )}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const overdue = isOverdue(task);
              const completed = task.status === "completed";
              const TypeIcon = TYPE_ICONS[task.type] ?? ListChecks;

              return (
                <TableRow
                  key={task.id}
                  className={cn(
                    "h-12",
                    completed && "opacity-60"
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={completed}
                      onCheckedChange={() => {
                        if (completed) {
                          handleReopen(task.id);
                        } else {
                          handleComplete(task.id);
                        }
                      }}
                      aria-label={completed ? "Reopen task" : "Complete task"}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {completed ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                      ) : overdue ? (
                        <Clock className="size-4 shrink-0 text-destructive" />
                      ) : (
                        <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                      )}
                      <span
                        className={cn(
                          "font-medium",
                          completed && "line-through text-muted-foreground"
                        )}
                      >
                        {task.title}
                      </span>
                    </div>
                  </TableCell>
                  {!compact && (
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <TypeIcon className="size-3.5" />
                        <span className="capitalize">{task.type.replace("_", " ")}</span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px]", PRIORITY_CONFIG[task.priority]?.className)}
                    >
                      {PRIORITY_CONFIG[task.priority]?.label ?? task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.due_at ? (
                      <span
                        className={cn(
                          "text-sm",
                          overdue
                            ? "font-medium text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatDate(task.due_at)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {!compact && (
                    <>
                      <TableCell>
                        {task.contacts ? (
                          <button
                            className="text-sm text-primary hover:underline"
                            onClick={() =>
                              router.push(`/prospects/${task.contacts!.id}`)
                            }
                          >
                            {task.contacts.first_name}{" "}
                            {task.contacts.last_name ?? ""}
                          </button>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {task.team_members?.name ?? "—"}
                      </TableCell>
                    </>
                  )}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!completed && (
                          <DropdownMenuItem onClick={() => handleComplete(task.id)}>
                            <CheckCircle2 className="mr-2 size-4" />
                            Complete
                          </DropdownMenuItem>
                        )}
                        {completed && (
                          <DropdownMenuItem onClick={() => handleReopen(task.id)}>
                            <Circle className="mr-2 size-4" />
                            Reopen
                          </DropdownMenuItem>
                        )}
                        {!completed && task.status !== "cancelled" && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleCancel(task.id)}
                          >
                            Cancel
                          </DropdownMenuItem>
                        )}
                        {task.contacts && (
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/prospects/${task.contacts!.id}`)
                            }
                          >
                            View contact
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination — hidden in compact mode */}
      {!compact && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of{" "}
            {total} task{total !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateParams({ page: String(page - 1) })}
            >
              <ChevronLeft className="mr-1 size-4" />
              Prev
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => updateParams({ page: String(page + 1) })}
            >
              Next
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
