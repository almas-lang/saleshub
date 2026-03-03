"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskList, type TaskWithRelations } from "./task-list";
import { TaskForm } from "./task-form";

interface TasksPageClientProps {
  tasks: TaskWithRelations[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  teamMembers: { id: string; name: string }[];
}

export function TasksPageClient({
  tasks,
  total,
  page,
  perPage,
  totalPages,
  teamMembers,
}: TasksPageClientProps) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage follow-ups, calls, and to-dos.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 size-4" />
          New task
        </Button>
      </div>

      <TaskList
        tasks={tasks}
        total={total}
        page={page}
        perPage={perPage}
        totalPages={totalPages}
        onCreateClick={() => setFormOpen(true)}
      />

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        teamMembers={teamMembers}
      />
    </div>
  );
}
