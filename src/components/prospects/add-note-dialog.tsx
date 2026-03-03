"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactFirstName: string;
}

export function AddNoteDialog({
  open,
  onOpenChange,
  contactId,
  contactFirstName,
}: AddNoteDialogProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    const result = await safeFetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: contactId,
        type: "note",
        title: "Note added",
        body: text.trim(),
      }),
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Note added");
    setText("");
    onOpenChange(false);
    router.refresh();
  }, [text, contactId, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add note about {contactFirstName}</DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder="Write your note..."
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className="resize-y"
          autoFocus
        />
        <DialogFooter>
          <span className="mr-auto text-xs text-muted-foreground">
            Cmd+Enter to save
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!text.trim() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Saving..." : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
