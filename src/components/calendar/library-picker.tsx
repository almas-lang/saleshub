"use client";

import { useState } from "react";
import { Library, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import type { FormField } from "@/types/bookings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface LibraryRow {
  id: string;
  field: FormField;
}

interface LibraryPickerProps {
  /** Append a saved question to the form. Receives the field minus its library id. */
  onAdd: (field: Omit<FormField, "id" | "sectionId">) => void;
}

export function LibraryPicker({ onAdd }: LibraryPickerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LibraryRow[]>([]);

  async function load() {
    setLoading(true);
    const result = await safeFetch<LibraryRow[]>("/api/form-field-library");
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setRows(result.data);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) load();
  }

  function handleAdd(row: LibraryRow) {
    onAdd(row.field);
    toast.success("Question added");
    setOpen(false);
  }

  async function handleDelete(id: string) {
    const result = await safeFetch(`/api/form-field-library/${id}`, { method: "DELETE" });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full border-dashed border-muted-foreground/25">
          <Library className="mr-2 size-4" />
          Add from library
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Saved questions</DialogTitle>
          <DialogDescription>
            Reuse a question you saved from any booking page.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No saved questions yet. Use the bookmark icon on a question to save it here.
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-2 rounded-lg border bg-card p-3"
              >
                <span className="flex-1 text-sm font-medium">{row.field.label}</span>
                <Badge variant="secondary" className="text-xs">
                  {row.field.type}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => handleAdd(row)}>
                  Add
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.id)}
                  title="Remove from library"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
