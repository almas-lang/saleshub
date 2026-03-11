"use client";

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
import { Plus } from "lucide-react";
import type { FormField } from "@/types/bookings";
import { Button } from "@/components/ui/button";
import { FormFieldCard } from "./form-field-card";

/** Fields with these types cannot be deleted — they're required for bookings to work. */
function isLocked(field: FormField) {
  return field.type === "email";
}

interface FormFieldEditorProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

export function FormFieldEditor({ fields, onChange }: FormFieldEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    onChange(arrayMove(fields, oldIndex, newIndex));
  }

  function handleUpdate(updated: FormField) {
    onChange(fields.map((f) => (f.id === updated.id ? updated : f)));
  }

  function handleDelete(id: string) {
    const field = fields.find((f) => f.id === id);
    if (field && isLocked(field)) return;
    onChange(fields.filter((f) => f.id !== id));
  }

  function handleAdd() {
    const newField: FormField = {
      id: `f-${Date.now()}`,
      label: "New Question",
      type: "text",
      required: false,
      placeholder: "",
    };
    onChange([...fields, newField]);
  }

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {fields.map((field) => (
              <FormFieldCard
                key={field.id}
                field={field}
                locked={isLocked(field)}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        variant="outline"
        className="w-full border-dashed border-muted-foreground/25"
        onClick={handleAdd}
      >
        <Plus className="mr-2 size-4" />
        Add question
      </Button>
    </div>
  );
}
