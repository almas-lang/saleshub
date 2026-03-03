"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { Inbox, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContactWithStage } from "@/types/contacts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { KanbanCard } from "./kanban-card";

interface FunnelOption {
  id: string;
  name: string;
}

interface StageOption {
  id: string;
  name: string;
  color: string;
  funnel_id: string;
  order: number;
}

interface ProspectKanbanProps {
  contacts: ContactWithStage[];
  funnels: FunnelOption[];
  stages: StageOption[];
  currentFunnelId: string;
  lastActivityMap: Record<string, string>;
}

function KanbanColumn({
  stage,
  children,
  count,
  isOver,
}: {
  stage: StageOption;
  children: React.ReactNode;
  count: number;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[290px] shrink-0 flex-col rounded-xl border transition-all duration-200",
        isOver
          ? "border-primary/40 bg-primary/[0.03] shadow-sm"
          : "bg-muted/20"
      )}
    >
      {/* Column header */}
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center gap-2.5 rounded-t-xl border-b px-3.5 py-3 transition-colors duration-200",
          isOver ? "bg-primary/10" : "bg-background"
        )}
      >
        <span
          className="inline-block size-2.5 rounded-full ring-2 ring-background"
          style={{ backgroundColor: stage.color }}
        />
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
          {stage.name}
        </span>
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>

      {/* Cards */}
      <div
        className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-2"
        style={{ minHeight: 200 }}
      >
        {children}
        {count === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/15 px-4 py-10">
            <Inbox className="size-5 text-muted-foreground/30" />
            <p className="text-center text-xs leading-relaxed text-muted-foreground/50">
              No prospects here &mdash;
              <br />
              that&apos;s either great or concerning
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProspectKanban({
  contacts: initialContacts,
  funnels,
  stages,
  currentFunnelId,
  lastActivityMap,
}: ProspectKanbanProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contacts, setContacts] = useState(initialContacts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const dropTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Mobile: contact being moved via bottom sheet
  const [moveContact, setMoveContact] = useState<ContactWithStage | null>(null);

  // Clear drop animation timer on unmount
  useEffect(() => {
    return () => {
      if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const funnelStages = stages
    .filter((s) => s.funnel_id === currentFunnelId)
    .sort((a, b) => a.order - b.order);

  // Build stage color lookup
  const stageColorMap = new Map<string, string>();
  for (const stage of funnelStages) {
    stageColorMap.set(stage.id, stage.color);
  }

  const contactsByStage = new Map<string, ContactWithStage[]>();
  for (const stage of funnelStages) {
    contactsByStage.set(stage.id, []);
  }
  for (const contact of contacts) {
    const stageId = contact.current_stage_id;
    if (stageId && contactsByStage.has(stageId)) {
      contactsByStage.get(stageId)!.push(contact);
    }
  }

  const activeContact = activeId
    ? contacts.find((c) => c.id === activeId) ?? null
    : null;

  function handleFunnelChange(funnelId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "kanban");
    params.set("funnel_id", funnelId);
    router.push(`/prospects?${params.toString()}`);
  }

  // ── Shared move logic (used by drag-drop and mobile sheet) ──
  const moveContactToStage = useCallback(
    async (contactId: string, newStageId: string) => {
      const contact = contacts.find((c) => c.id === contactId);
      if (!contact || contact.current_stage_id === newStageId) return;

      // Trigger drop splash animation
      setJustDroppedId(contactId);
      if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
      dropTimerRef.current = setTimeout(() => setJustDroppedId(null), 500);

      // Optimistic update
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId ? { ...c, current_stage_id: newStageId } : c
        )
      );

      const result = await safeFetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_stage_id: newStageId }),
      });

      if (!result.ok) {
        // Revert on failure
        setContacts((prev) =>
          prev.map((c) =>
            c.id === contactId
              ? { ...c, current_stage_id: contact.current_stage_id }
              : c
          )
        );
        toast.error(result.error);
        return;
      }

      const stage = stages.find((s) => s.id === newStageId);
      toast.success(`Moved to ${stage?.name ?? "new stage"}`);
    },
    [contacts, stages]
  );

  // ── Drag-and-drop handlers (desktop) ──
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverStageId((event.over?.id as string) ?? null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      setOverStageId(null);

      const { active, over } = event;
      if (!over) return;

      await moveContactToStage(active.id as string, over.id as string);
    },
    [moveContactToStage]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverStageId(null);
  }, []);

  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(
    new Set()
  );

  function toggleStageCollapse(stageId: string) {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {/* Funnel Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Funnel:
        </span>
        <Select value={currentFunnelId} onValueChange={handleFunnelChange}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select funnel" />
          </SelectTrigger>
          <SelectContent>
            {funnels.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Board */}
      <div className="hidden lg:block">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {funnelStages.map((stage) => {
              const stageContacts = contactsByStage.get(stage.id) ?? [];
              return (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  count={stageContacts.length}
                  isOver={overStageId === stage.id}
                >
                  {stageContacts.map((contact) => (
                    <KanbanCard
                      key={contact.id}
                      contact={contact}
                      lastActivity={lastActivityMap[contact.id]}
                      stageColor={stage.color}
                      justDropped={justDroppedId === contact.id}
                    />
                  ))}
                </KanbanColumn>
              );
            })}
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
            {activeContact && (
              <KanbanCard
                contact={activeContact}
                lastActivity={lastActivityMap[activeContact.id]}
                stageColor={
                  stageColorMap.get(activeContact.current_stage_id ?? "") ??
                  "#94A3B8"
                }
                isOverlay
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Mobile Vertical List */}
      <div className="lg:hidden space-y-3">
        {funnelStages.map((stage) => {
          const stageContacts = contactsByStage.get(stage.id) ?? [];
          const isCollapsed = collapsedStages.has(stage.id);

          return (
            <div key={stage.id} className="rounded-xl border bg-card">
              <button
                className="flex w-full items-center gap-2.5 px-4 py-3"
                onClick={() => toggleStageCollapse(stage.id)}
              >
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
                  {stage.name}
                </span>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {stageContacts.length}
                </span>
                <ChevronDown
                  className={cn(
                    "ml-auto size-4 text-muted-foreground transition-transform",
                    isCollapsed && "-rotate-90"
                  )}
                />
              </button>

              {!isCollapsed && (
                <div className="space-y-2 px-3 pb-3">
                  {stageContacts.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-muted-foreground/15 px-4 py-6">
                      <Inbox className="size-5 text-muted-foreground/30" />
                      <p className="text-center text-xs text-muted-foreground/50">
                        No prospects in this stage
                      </p>
                    </div>
                  ) : (
                    stageContacts.map((contact) => (
                      <KanbanCard
                        key={contact.id}
                        contact={contact}
                        lastActivity={lastActivityMap[contact.id]}
                        stageColor={stage.color}
                        justDropped={justDroppedId === contact.id}
                        onMovePress={() => setMoveContact(contact)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: Move-to-stage bottom sheet */}
      <Sheet
        open={!!moveContact}
        onOpenChange={(open) => {
          if (!open) setMoveContact(null);
        }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl" showCloseButton={false}>
          <SheetTitle className="sr-only">Move prospect to stage</SheetTitle>
          <SheetDescription className="sr-only">
            Select a funnel stage to move this prospect to
          </SheetDescription>

          {/* Drag handle */}
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/20" />

          <p className="mb-4 text-center text-sm">
            Move{" "}
            <span className="font-semibold">
              {moveContact?.first_name} {moveContact?.last_name ?? ""}
            </span>{" "}
            to&hellip;
          </p>

          <div className="mb-2 space-y-1">
            {funnelStages.map((stage) => {
              const isCurrent =
                moveContact?.current_stage_id === stage.id;
              return (
                <button
                  key={stage.id}
                  disabled={isCurrent}
                  onClick={() => {
                    if (moveContact) {
                      moveContactToStage(moveContact.id, stage.id);
                    }
                    setMoveContact(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors",
                    isCurrent
                      ? "bg-muted text-muted-foreground"
                      : "active:bg-accent"
                  )}
                >
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className={cn(isCurrent && "font-medium")}>
                    {stage.name}
                  </span>
                  {isCurrent && (
                    <Check className="ml-auto size-4 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
