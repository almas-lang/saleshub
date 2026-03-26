"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { safeFetch, throwOnError } from "@/lib/fetch";
import type { EmailTemplate } from "@/types/email-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailBlockEditor } from "./email-block-editor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplate | null;
}

export function EmailTemplateEditorDialog({
  open,
  onOpenChange,
  template,
}: Props) {
  const router = useRouter();
  const isEditing = !!template;

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setSubject(template.subject);
      setBodyHtml(template.body_html);
    } else {
      setName("");
      setSubject("");
      setBodyHtml("");
    }
  }, [template, open]);

  async function handleSave() {
    if (!name.trim() || !subject.trim()) {
      toast.error("Name and subject are required");
      return;
    }

    setSaving(true);
    try {
      const payload = { name, subject, body_html: bodyHtml };

      if (isEditing) {
        await throwOnError(
          safeFetch(`/api/email-templates/${template.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        );
        toast.success("Template updated");
      } else {
        await throwOnError(
          safeFetch("/api/email-templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        );
        toast.success("Template created");
      }

      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle>
            {isEditing ? "Edit template" : "New email template"}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-6">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name" className="text-sm font-medium">
                Template name
              </Label>
              <Input
                id="tpl-name"
                placeholder="e.g. Welcome Series — Day 1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="tpl-subject" className="text-sm font-medium">
                Subject line
              </Label>
              <Input
                id="tpl-subject"
                placeholder="e.g. Welcome to {{business_name}}"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                Use {"{{variable}}"} for personalization
              </p>
            </div>

            {/* Editor */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Email body</Label>
              <EmailBlockEditor
                key={template?.id ?? "new"}
                content={bodyHtml}
                onChange={setBodyHtml}
                placeholder="Write your email content here..."
              />
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditing ? "Save changes" : "Create template"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
