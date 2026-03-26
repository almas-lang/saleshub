"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { ArrowLeft, Plus, Pencil, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import type { FunnelWithStages } from "@/types/funnels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { StageCard, COLOR_PALETTE, type StageItem } from "./stage-card";
import { FunnelPipeline } from "./funnel-pipeline";
import { FunnelForm } from "./funnel-form";

const SALES_TYPE_LABELS: Record<string, string> = {
  vsl: "VSL",
  webinar: "Webinar",
  workshop: "Workshop",
  short_course: "Short Course",
  direct_outreach: "Direct Outreach",
  custom: "Custom",
};

export function FunnelBuilder({
  funnel,
  stageContactCounts = {},
}: {
  funnel: FunnelWithStages;
  stageContactCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Stage state — initialised from server data
  const [stages, setStages] = useState<StageItem[]>(
    funnel.funnel_stages.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      color: s.color,
      is_terminal: s.is_terminal,
    }))
  );
  const [dirty, setDirty] = useState(false);

  // New stage form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]);
  const [newTerminal, setNewTerminal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setStages((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      const reordered = arrayMove(items, oldIndex, newIndex);
      return reordered.map((item, idx) => ({ ...item, order: idx + 1 }));
    });
    setDirty(true);
  }

  function handleUpdateStage(updated: StageItem) {
    setStages((items) =>
      items.map((s) => (s.id === updated.id ? updated : s))
    );
    setDirty(true);
  }

  function handleDeleteStage(id: string) {
    setStages((items) => {
      const filtered = items.filter((s) => s.id !== id);
      return filtered.map((s, idx) => ({ ...s, order: idx + 1 }));
    });
    setDirty(true);
  }

  function handleAddStage() {
    if (!newName.trim()) return;

    const newStage: StageItem = {
      id: `new-${Date.now()}`,
      name: newName.trim(),
      order: stages.length + 1,
      color: newColor,
      is_terminal: newTerminal,
    };

    setStages((items) => [...items, newStage]);
    setDirty(true);
    setNewName("");
    setNewColor(COLOR_PALETTE[0]);
    setNewTerminal(false);
    setShowAddForm(false);
  }

  const handleSave = useCallback(async () => {
    setSaving(true);

    const stagePayload = stages.map((s) => ({
      name: s.name,
      order: s.order,
      color: s.color,
      is_terminal: s.is_terminal,
    }));

    const result = await safeFetch(`/api/funnels/${funnel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stages: stagePayload }),
    });

    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Stages saved");
    setDirty(false);
    router.refresh();
  }, [stages, funnel.id, router]);

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/funnels">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{funnel.name}</h1>
            <Badge variant="secondary">
              {SALES_TYPE_LABELS[funnel.sales_type] ?? funnel.sales_type}
            </Badge>
            {funnel.is_default && <Badge variant="outline">Default</Badge>}
          </div>
          {funnel.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {funnel.description}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={() => setEditFormOpen(true)}>
          <Pencil className="mr-2 size-4" />
          Edit details
        </Button>
      </div>

      {/* Pipeline visualization */}
      <FunnelPipeline stages={stages} contactCounts={stageContactCounts} />

      <Separator />

      {/* Stage editor */}
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">
            Stages ({stages.length})
          </h2>
          {dirty && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              Save changes
            </Button>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={stages.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {stages.map((stage) => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  contactCount={stageContactCounts[stage.id]}
                  onUpdate={handleUpdateStage}
                  onDelete={handleDeleteStage}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add stage */}
        {showAddForm ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 p-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Stage name"
              className="h-8 w-40"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddStage();
                if (e.key === "Escape") setShowAddForm(false);
              }}
            />
            <div className="flex items-center gap-1">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`size-5 rounded-full border-2 transition-transform ${
                    newColor === c
                      ? "scale-125 border-foreground"
                      : "border-transparent hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={newTerminal}
                onCheckedChange={(checked) =>
                  setNewTerminal(checked === true)
                }
              />
              Terminal
            </label>
            <div className="flex gap-1">
              <Button size="sm" onClick={handleAddStage} disabled={!newName.trim()}>
                Add
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full border-dashed border-muted-foreground/25"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="mr-2 size-4" />
            Add stage
          </Button>
        )}
      </div>

      <FunnelForm
        open={editFormOpen}
        onOpenChange={setEditFormOpen}
        funnel={funnel}
      />
    </div>
  );
}
