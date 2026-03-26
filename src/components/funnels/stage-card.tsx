"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export interface StageItem {
  id: string;
  name: string;
  order: number;
  color: string;
  is_terminal: boolean;
}

const COLOR_PALETTE = [
  "#94A3B8",
  "#60A5FA",
  "#A78BFA",
  "#F59E0B",
  "#FB923C",
  "#34D399",
  "#EF4444",
  "#EC4899",
  "#14B8A6",
  "#8B5CF6",
];

interface StageCardProps {
  stage: StageItem;
  contactCount?: number;
  onUpdate: (stage: StageItem) => void;
  onDelete: (id: string) => void;
}

export function StageCard({ stage, contactCount, onUpdate, onDelete }: StageCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(stage.name);
  const [editColor, setEditColor] = useState(stage.color);
  const [editTerminal, setEditTerminal] = useState(stage.is_terminal);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function handleSave() {
    if (!editName.trim()) return;
    onUpdate({
      ...stage,
      name: editName.trim(),
      color: editColor,
      is_terminal: editTerminal,
    });
    setIsEditing(false);
  }

  function handleCancel() {
    setEditName(stage.name);
    setEditColor(stage.color);
    setEditTerminal(stage.is_terminal);
    setIsEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 rounded-lg border bg-card p-3 shadow-none ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="size-5" />
      </button>

      {isEditing ? (
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-8 w-40"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <div className="flex items-center gap-1">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEditColor(c)}
                className={`size-5 rounded-full border-2 transition-transform ${
                  editColor === c
                    ? "scale-125 border-foreground"
                    : "border-transparent hover:scale-110"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-sm">
            <Checkbox
              checked={editTerminal}
              onCheckedChange={(checked) =>
                setEditTerminal(checked === true)
              }
            />
            Terminal
          </label>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="size-7" onClick={handleSave}>
              <Check className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="size-7" onClick={handleCancel}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="size-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <span className="flex-1 text-sm font-medium">{stage.name}</span>
          {contactCount !== undefined && contactCount > 0 && (
            <Badge variant="secondary" className="text-[11px] font-normal">
              {contactCount} contact{contactCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {stage.is_terminal && (
            <Badge variant="outline" className="text-xs">
              Terminal
            </Badge>
          )}
          <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(stage.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export { COLOR_PALETTE };
