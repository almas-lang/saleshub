"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Check, X, Plus, Lock } from "lucide-react";
import type { FormField } from "@/types/bookings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FIELD_TYPES: { value: FormField["type"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "textarea", label: "Textarea" },
  { value: "radio", label: "Radio" },
  { value: "select", label: "Select" },
];

const TYPE_COLORS: Record<string, string> = {
  text: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  email: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  phone: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  textarea: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  radio: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  select: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
};

interface FormFieldCardProps {
  field: FormField;
  locked?: boolean;
  onUpdate: (field: FormField) => void;
  onDelete: (id: string) => void;
}

export function FormFieldCard({ field, locked, onUpdate, onDelete }: FormFieldCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(field.label);
  const [editType, setEditType] = useState(field.type);
  const [editRequired, setEditRequired] = useState(field.required);
  const [editPlaceholder, setEditPlaceholder] = useState(field.placeholder ?? "");
  const [editOptions, setEditOptions] = useState<string[]>(field.options ?? []);
  const [newOption, setNewOption] = useState("");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasOptions = editType === "radio" || editType === "select";

  function handleSave() {
    if (!editLabel.trim()) return;
    onUpdate({
      ...field,
      label: editLabel.trim(),
      type: editType,
      required: editRequired,
      placeholder: editPlaceholder || undefined,
      options: hasOptions ? editOptions : undefined,
    });
    setIsEditing(false);
  }

  function handleCancel() {
    setEditLabel(field.label);
    setEditType(field.type);
    setEditRequired(field.required);
    setEditPlaceholder(field.placeholder ?? "");
    setEditOptions(field.options ?? []);
    setIsEditing(false);
  }

  function addOption() {
    if (!newOption.trim()) return;
    setEditOptions([...editOptions, newOption.trim()]);
    setNewOption("");
  }

  function removeOption(index: number) {
    setEditOptions(editOptions.filter((_, i) => i !== index));
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-3 rounded-lg border bg-card p-3 shadow-none ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="size-5" />
      </button>

      {isEditing ? (
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              className="h-8 flex-1 min-w-[180px]"
              placeholder="Question label"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") handleCancel();
              }}
            />
            <Select
              value={editType}
              onValueChange={(v) => setEditType(v as FormField["type"])}
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={editRequired}
                onCheckedChange={(c) => setEditRequired(c === true)}
              />
              Required
            </label>
          </div>

          <Input
            value={editPlaceholder}
            onChange={(e) => setEditPlaceholder(e.target.value)}
            className="h-8"
            placeholder="Placeholder text (optional)"
          />

          {hasOptions && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Options</p>
              <div className="flex flex-wrap gap-1.5">
                {editOptions.map((opt, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {opt}
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="ml-0.5 rounded-full hover:bg-destructive/20"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  className="h-7 text-sm"
                  placeholder="Add option..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={addOption}
                  disabled={!newOption.trim()}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-1">
            <Button size="sm" onClick={handleSave}>
              <Check className="mr-1 size-3.5" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center gap-2">
          <span className="flex-1 text-sm font-medium">{field.label}</span>
          <Badge
            variant="secondary"
            className={`text-xs ${TYPE_COLORS[field.type] ?? ""}`}
          >
            {field.type}
          </Badge>
          {field.required && (
            <Badge variant="outline" className="text-xs">
              Required
            </Badge>
          )}
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            {locked ? (
              <div className="flex size-7 items-center justify-center" title="Required for bookings">
                <Lock className="size-3.5 text-muted-foreground" />
              </div>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-destructive hover:text-destructive"
                onClick={() => onDelete(field.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
