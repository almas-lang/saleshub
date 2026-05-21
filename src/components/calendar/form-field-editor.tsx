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
import type { FormField, FormSection } from "@/types/bookings";
import { Button } from "@/components/ui/button";
import { FormFieldCard } from "./form-field-card";
import { LibraryPicker } from "./library-picker";

/** Fields with these types cannot be deleted — they're required for bookings to work. */
function isLocked(field: FormField) {
  return field.type === "email";
}

interface FormFieldEditorProps {
  fields: FormField[];
  sections?: FormSection[];
  onChange: (fields: FormField[]) => void;
}

export function FormFieldEditor({ fields, sections = [], onChange }: FormFieldEditorProps) {
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

  function handleAddFromLibrary(field: Omit<FormField, "id" | "sectionId">) {
    onChange([...fields, { ...field, id: `f-${Date.now()}` }]);
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
                sections={sections}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="w-full border-dashed border-muted-foreground/25"
          onClick={handleAdd}
        >
          <Plus className="mr-2 size-4" />
          Add question
        </Button>
        <LibraryPicker onAdd={handleAddFromLibrary} />
      </div>
    </div>
  );
}
