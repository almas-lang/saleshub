"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Braces } from "lucide-react";
import { toast } from "sonner";
import { safeFetch, throwOnError } from "@/lib/fetch";
import type { EmailTemplate } from "@/types/email-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailBlockEditor } from "./email-block-editor";

const EMAIL_VARIABLES = [
  { group: "Contact", items: [
    { value: "first_name", label: "First Name" },
    { value: "last_name", label: "Last Name" },
    { value: "email", label: "Email" },
    { value: "company_name", label: "Company Name" },
  ]},
  { group: "Booking", items: [
    { value: "booking_date", label: "Booking Date" },
    { value: "booking_time", label: "Booking Time" },
    { value: "booking_meet_link", label: "Google Meet Link" },
    { value: "booking_reschedule_link", label: "Reschedule Link" },
  ]},
  { group: "System", items: [
    { value: "unsubscribe_link", label: "Unsubscribe Link" },
  ]},
];

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

  const subjectRef = useRef<HTMLInputElement>(null);

  function insertVariableInSubject(varName: string) {
    const el = subjectRef.current;
    const tag = `{{${varName}}}`;
    if (el) {
      const start = el.selectionStart ?? subject.length;
      const end = el.selectionEnd ?? subject.length;
      setSubject(subject.slice(0, start) + tag + subject.slice(end));
    } else {
      setSubject(subject + tag);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-lg"
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
              <div className="flex items-center justify-between">
                <Label htmlFor="tpl-subject" className="text-sm font-medium">
                  Subject line
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] gap-1">
                      <Braces className="size-3" /> Insert Variable
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="end">
                    {EMAIL_VARIABLES.map((group) => (
                      <div key={group.group} className="mb-2 last:mb-0">
                        <p className="text-[10px] font-medium text-muted-foreground px-2 py-1">{group.group}</p>
                        {group.items.map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50"
                            onClick={() => insertVariableInSubject(item.value)}
                          >
                            <span className="font-medium">{item.label}</span>
                            <Badge variant="secondary" className="ml-2 text-[9px] font-mono">
                              {`{{${item.value}}}`}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
              <Input
                ref={subjectRef}
                id="tpl-subject"
                placeholder="e.g. Welcome to {{company_name}}"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                Use {"{{variable}}"} for personalization
              </p>
            </div>

            {/* Variable reference */}
            <div className="rounded-md border border-dashed p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Available Variables</p>
              <div className="flex flex-wrap gap-1.5">
                {EMAIL_VARIABLES.flatMap((g) =>
                  g.items.map((item) => (
                    <Badge key={item.value} variant="secondary" className="text-[10px] font-mono cursor-default">
                      {`{{${item.value}}}`}
                    </Badge>
                  ))
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Type these in the subject or body. They&apos;ll be replaced with real data when sent.
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
