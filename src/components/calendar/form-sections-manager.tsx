"use client";

import { ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";
import type { FormSection } from "@/types/bookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FormSectionsManagerProps {
  sections: FormSection[];
  onChange: (sections: FormSection[]) => void;
}

/** Normalize `order` to match array position so it always reflects display order. */
function reindex(sections: FormSection[]): FormSection[] {
  return sections.map((s, i) => ({ ...s, order: i }));
}

export function FormSectionsManager({ sections, onChange }: FormSectionsManagerProps) {
  function update(id: string, patch: Partial<FormSection>) {
    onChange(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function remove(id: string) {
    onChange(reindex(sections.filter((s) => s.id !== id)));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(reindex(next));
  }

  function add() {
    onChange(
      reindex([
        ...sections,
        { id: `s-${Date.now()}`, title: "New Section", description: "", order: sections.length },
      ])
    );
  }

  return (
    <div className="space-y-2">
      {sections.map((section, i) => (
        <div key={section.id} className="rounded-lg border bg-card p-3">
          <div className="flex items-start gap-2">
            <div className="flex flex-col">
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                onClick={() => move(i, -1)}
                disabled={i === 0}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                onClick={() => move(i, 1)}
                disabled={i === sections.length - 1}
              >
                <ChevronDown className="size-4" />
              </Button>
            </div>
            <div className="flex-1 space-y-2">
              <Input
                value={section.title}
                onChange={(e) => update(section.id, { title: e.target.value })}
                className="h-8 font-medium"
                placeholder="Section title"
              />
              <Input
                value={section.description ?? ""}
                onChange={(e) => update(section.id, { description: e.target.value || undefined })}
                className="h-8 text-sm"
                placeholder="Section description (optional)"
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-destructive hover:text-destructive"
              onClick={() => remove(section.id)}
              title="Delete section (its questions move to ungrouped)"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ))}

      <Button
        variant="outline"
        className="w-full border-dashed border-muted-foreground/25"
        onClick={add}
      >
        <Plus className="mr-2 size-4" />
        Add section
      </Button>
    </div>
  );
}
