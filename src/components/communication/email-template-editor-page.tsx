"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Braces, Eye, Pencil, Monitor, Smartphone } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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
    { value: "google_calendar_link", label: "Add to Google Calendar" },
    { value: "apple_calendar_link", label: "Add to Apple Calendar" },
  ]},
  { group: "System", items: [
    { value: "unsubscribe_link", label: "Unsubscribe Link" },
  ]},
];

const SAMPLE_DATA: Record<string, string> = {
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
  company_name: "Acme Inc.",
  booking_date: "April 15, 2026",
  booking_time: "10:00 AM",
  booking_meet_link: "https://meet.google.com/abc-defg-hij",
  booking_reschedule_link: "https://cal.com/reschedule/123",
  google_calendar_link: "https://calendar.google.com/calendar/render?action=TEMPLATE&text=...",
  apple_calendar_link: "https://app.xperiencewave.com/api/calendar/ics?...",
  unsubscribe_link: "#",
};

interface Props {
  template?: EmailTemplate | null;
}

export function EmailTemplateEditorPage({ template }: Props) {
  const router = useRouter();
  const isEditing = !!template;

  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [previewText, setPreviewText] = useState(template?.preview_text ?? "");
  const [bodyHtml, setBodyHtml] = useState(template?.body_html ?? "");
  const [saving, setSaving] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

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

  function replaceVariables(text: string): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => SAMPLE_DATA[key] ?? `{{${key}}}`);
  }

  async function handleSave() {
    if (!name.trim() || !subject.trim()) {
      toast.error("Name and subject are required");
      return;
    }

    setSaving(true);
    try {
      const payload = { name, subject, preview_text: previewText || null, body_html: bodyHtml };

      if (isEditing && template) {
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

      router.push("/email/templates");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/email/templates")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-base font-semibold">
            {isEditing ? "Edit template" : "New email template"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/email/templates")}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditing ? "Save changes" : "Create template"}
          </Button>
        </div>
      </div>

      {/* Main content: editor left, preview right */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Editor panel ── */}
        <div className="w-1/2 border-r">
          <ScrollArea className="h-full">
            <div className="space-y-5 p-6">
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

              {/* Preview text */}
              <div className="space-y-1.5">
                <Label htmlFor="tpl-preview" className="text-sm font-medium">
                  Preview text
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (shown in inbox before opening)
                  </span>
                </Label>
                <Input
                  id="tpl-preview"
                  placeholder="Optional preview text..."
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  maxLength={150}
                  className="h-9"
                />
                {previewText && (
                  <p className="text-[11px] text-muted-foreground">
                    {previewText.length}/150 characters
                  </p>
                )}
              </div>

              {/* Variable reference */}
              <div className="rounded-md border border-dashed p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Available Variables
                </p>
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
        </div>

        {/* ── Preview panel ── */}
        <div className="flex w-1/2 flex-col bg-muted/30 overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-2 shrink-0">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Eye className="size-4" />
              Preview
            </div>
            <Tabs
              value={previewDevice}
              onValueChange={(v) => setPreviewDevice(v as "desktop" | "mobile")}
            >
              <TabsList className="h-7">
                <TabsTrigger value="desktop" className="h-6 px-2 text-xs gap-1">
                  <Monitor className="size-3" /> Desktop
                </TabsTrigger>
                <TabsTrigger value="mobile" className="h-6 px-2 text-xs gap-1">
                  <Smartphone className="size-3" /> Mobile
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="flex justify-center p-6">
              <div
                className={cn(
                  "rounded-lg border bg-white shadow-sm transition-all duration-200",
                  previewDevice === "desktop" ? "w-full max-w-[600px]" : "w-[375px]"
                )}
              >
                {/* Email header */}
                <div className="border-b px-6 py-4">
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">Subject:</span>
                      <span className="text-foreground">
                        {subject ? replaceVariables(subject) : "No subject"}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">To:</span>
                      <span>{SAMPLE_DATA.email}</span>
                    </div>
                    {previewText && (
                      <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/70">Preview:</span>
                        <span className="italic">{replaceVariables(previewText)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Email body */}
                <div className="px-6 py-5">
                  {bodyHtml ? (
                    <div
                      className="prose prose-sm max-w-none text-foreground dark:text-zinc-800 break-words [&_a]:text-blue-600 [&_a]:break-all [&_img]:max-w-full [&_img]:rounded [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
                      dangerouslySetInnerHTML={{
                        __html: replaceVariables(bodyHtml),
                      }}
                    />
                  ) : (
                    <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                      Start typing to see a preview
                    </div>
                  )}
                </div>

                {/* Email footer */}
                <div className="border-t px-6 py-3 text-center">
                  <p className="text-[10px] text-muted-foreground">
                    This is a preview with sample data. Variables will be replaced with real contact data when sent.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
