"use client";

import { useState } from "react";
import { Plus, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskForm } from "@/components/tasks/task-form";
import { ProspectForm } from "@/components/prospects/prospect-form";

interface QuickActionsProps {
  teamMembers: { id: string; name: string }[];
  funnels: { id: string; name: string }[];
  stages: { id: string; name: string; funnel_id: string }[];
}

export function QuickActions({ teamMembers, funnels, stages }: QuickActionsProps) {
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [prospectFormOpen, setProspectFormOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => setProspectFormOpen(true)}>
          <Plus className="mr-2 size-4" />
          Add prospect
        </Button>
        <Button variant="outline" onClick={() => setTaskFormOpen(true)}>
          <ClipboardList className="mr-2 size-4" />
          Create task
        </Button>
      </div>

      <TaskForm
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        teamMembers={teamMembers}
      />

      <ProspectForm
        open={prospectFormOpen}
        onOpenChange={setProspectFormOpen}
        prospect={null}
        funnels={funnels}
        stages={stages}
        teamMembers={teamMembers}
      />
    </>
  );
}
