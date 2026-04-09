"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Trash2,
  Bold,
  Italic,
  Strikethrough,
  Braces,
  Image,
  Video,
  FileText,
  Type,
  Phone,
  ExternalLink,
  Reply,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { safeFetch } from "@/lib/fetch";

// ── Types ──

type HeaderFormat = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
type ButtonType = "URL" | "PHONE_NUMBER" | "QUICK_REPLY";

interface TemplateButton {
  type: ButtonType;
  text: string;
  url?: string;
  phone_number?: string;
}

// ── Constants ──

const CATEGORY_INFO = {
  UTILITY: {
    desc: "Transactional messages related to an existing relationship or transaction.",
    examples: "Order updates, appointment reminders, payment confirmations, account alerts",
  },
  MARKETING: {
    desc: "Promotional messages to drive awareness, engagement, or sales.",
    examples: "Product launches, offers, newsletters, event invites, re-engagement",
  },
} as const;

const VARIABLE_SUGGESTIONS = [
  { placeholder: "Customer name", example: "John" },
  { placeholder: "Order ID / reference", example: "ORD-12345" },
  { placeholder: "Date / time", example: "31 Mar 2026" },
  { placeholder: "Amount / value", example: "$99.00" },
  { placeholder: "Link / URL", example: "https://example.com" },
];

// ── Page ──

export default function NewTemplatePage() {
  const router = useRouter();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [varOpen, setVarOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY">("UTILITY");
  const [language, setLanguage] = useState("en_US");
  const [headerFormat, setHeaderFormat] = useState<HeaderFormat>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [sampleValues, setSampleValues] = useState<Record<number, string>>({});

  const nameError =
    name && !/^[a-z0-9_]*$/.test(name)
      ? "Only lowercase letters, numbers, and underscores"
      : null;

  const varNumbers = [...(body.matchAll(/\{\{(\d+)\}\}/g))].map((m) => parseInt(m[1]));
  const uniqueVars = [...new Set(varNumbers)].sort((a, b) => a - b);
  const nextVar = uniqueVars.length > 0 ? Math.max(...uniqueVars) + 1 : 1;
  const canSubmit = name.length > 0 && !nameError && body.length > 0 && !saving;

  function insertVariable() {
    const ta = bodyRef.current;
    const tag = `{{${nextVar}}}`;
    if (ta) {
      const start = ta.selectionStart ?? body.length;
      const end = ta.selectionEnd ?? body.length;
      const next = body.slice(0, start) + tag + body.slice(end);
      setBody(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + tag.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      setBody(body + tag);
    }
  }

  function insertFormatting(prefix: string, suffix: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    const selected = body.slice(start, end);
    const next = body.slice(0, start) + prefix + selected + suffix + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, end + prefix.length);
    });
  }

  function addButton(type: ButtonType) {
    if (buttons.length >= 3) return;
    setButtons([...buttons, { type, text: "", url: "", phone_number: "" }]);
  }

  function updateButton(idx: number, partial: Partial<TemplateButton>) {
    setButtons(buttons.map((b, i) => (i === idx ? { ...b, ...partial } : b)));
  }

  function removeButton(idx: number) {
    setButtons(buttons.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    setSaving(true);
    setSubmitError(null);

    // Client-side validation
    const errors: string[] = [];
    if (!name) errors.push("Template name is required.");
    if (!body) errors.push("Body text is required.");
    if (headerFormat === "TEXT" && !headerText) errors.push("Header text is required when header type is Text.");
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      if (!b.text) errors.push(`Button ${i + 1}: text is required.`);
      if (b.type === "URL" && !b.url) errors.push(`Button ${i + 1}: URL is required.`);
      if (b.type === "PHONE_NUMBER" && !b.phone_number) errors.push(`Button ${i + 1}: phone number is required.`);
    }
    if (errors.length > 0) {
      setSubmitError(errors.join(" "));
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = { name, category, language, body, footer: footer || undefined };

    if (headerFormat !== "NONE") {
      payload.header = {
        format: headerFormat,
        text: headerFormat === "TEXT" ? headerText : undefined,
      };
    }
    if (buttons.length > 0) {
      payload.buttons = buttons.map((b) => ({
        type: b.type,
        text: b.text,
        ...(b.type === "URL" && b.url ? { url: b.url } : {}),
        ...(b.type === "PHONE_NUMBER" && b.phone_number ? { phone_number: b.phone_number } : {}),
      }));
    }

    // Send sample values for variables (required by Meta for review)
    if (uniqueVars.length > 0) {
      const examples = uniqueVars.map((num) =>
        sampleValues[num] || VARIABLE_SUGGESTIONS[num - 1]?.example || `example_${num}`
      );
      payload.body_examples = examples;
    }

    const result = await safeFetch("/api/whatsapp/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!result.ok) {
      const errMsg =
        typeof result.error === "string"
          ? result.error
          : typeof result.error === "object" && result.error !== null
            ? JSON.stringify(result.error)
            : "Failed to submit template";
      setSubmitError(errMsg);
      return;
    }

    toast.success("Template submitted for review");
    router.push("/whatsapp/templates");
  }

  function renderPreviewBody() {
    let preview = body || "Your message will appear here...";
    preview = preview.replace(/\{\{(\d+)\}\}/g, (_m, num) => {
      const val = sampleValues[parseInt(num)];
      return val || `[Variable ${num}]`;
    });
    preview = preview.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    preview = preview.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");
    preview = preview.replace(/_([^_]+)_/g, "<em>$1</em>");
    preview = preview.replace(/~([^~]+)~/g, "<del>$1</del>");
    preview = preview.replace(/\n/g, "<br/>");
    return preview;
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push("/whatsapp/templates")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Create WhatsApp Template</h1>
            <p className="text-xs text-muted-foreground">
              Templates are submitted to Meta for review. Once approved, they can be used in campaigns.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/whatsapp/templates")} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Submit for Review
          </Button>
        </div>
      </div>

      {/* Content: form + preview side by side */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_380px]">
        {/* Left: scrollable form */}
        <div className="overflow-y-auto px-8 py-6">
          <div className="mx-auto max-w-2xl space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label>
                Template Name
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  lowercase, no spaces — use underscores
                </span>
              </Label>
              <Input
                placeholder="e.g. welcome_message"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s/g, "_"))}
                className="max-w-sm"
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            {/* Category + Language */}
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en_US">English (US)</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border border-dashed p-3 max-w-md">
              <p className="text-xs font-medium">{category === "UTILITY" ? "Utility" : "Marketing"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{CATEGORY_INFO[category].desc}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Examples: {CATEGORY_INFO[category].examples}
              </p>
            </div>

            {/* Header */}
            <div className="space-y-2">
              <Label>Header</Label>
              <Select value={headerFormat} onValueChange={(v) => setHeaderFormat(v as HeaderFormat)}>
                <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  <SelectItem value="TEXT"><span className="flex items-center gap-2"><Type className="size-3.5" /> Text</span></SelectItem>
                  <SelectItem value="IMAGE"><span className="flex items-center gap-2"><Image className="size-3.5" /> Image</span></SelectItem>
                  <SelectItem value="VIDEO"><span className="flex items-center gap-2"><Video className="size-3.5" /> Video</span></SelectItem>
                  <SelectItem value="DOCUMENT"><span className="flex items-center gap-2"><FileText className="size-3.5" /> Document</span></SelectItem>
                </SelectContent>
              </Select>
              {headerFormat === "TEXT" && (
                <Input placeholder="Header text (max 60 chars)..." value={headerText} onChange={(e) => setHeaderText(e.target.value)} maxLength={60} />
              )}
              {(headerFormat === "IMAGE" || headerFormat === "VIDEO" || headerFormat === "DOCUMENT") && (
                <p className="text-xs text-muted-foreground rounded-md border border-dashed p-2 max-w-md">
                  The {headerFormat.toLowerCase()} file is attached when sending. Meta requires the media type to be declared at template creation.
                </p>
              )}
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label>Body</Label>
              <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 bg-muted/30 px-2 py-1.5">
                <Button type="button" variant="ghost" size="icon" className="size-7" title="Bold (*text*)" onClick={() => insertFormatting("*", "*")}>
                  <Bold className="size-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-7" title="Italic (_text_)" onClick={() => insertFormatting("_", "_")}>
                  <Italic className="size-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-7" title="Strikethrough (~text~)" onClick={() => insertFormatting("~", "~")}>
                  <Strikethrough className="size-3.5" />
                </Button>
                <div className="mx-1 h-4 w-px bg-border" />
                <Popover open={varOpen} onOpenChange={setVarOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                      <Braces className="size-3.5" /> Add Variable
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3" align="start">
                    <p className="text-xs font-medium mb-1">Insert Dynamic Variable</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Variables are numbered placeholders that get replaced with actual values when sent. For example, {"{{1}}"} could be the customer&apos;s name.
                    </p>
                    <Button size="sm" className="w-full" onClick={() => { insertVariable(); setVarOpen(false); }}>
                      Insert {`{{${nextVar}}}`}
                    </Button>
                  </PopoverContent>
                </Popover>
                {uniqueVars.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-[10px]">{uniqueVars.length} variable{uniqueVars.length !== 1 ? "s" : ""}</Badge>
                )}
              </div>
              <Textarea
                ref={bodyRef}
                className="rounded-t-none border-t-0 min-h-[140px]"
                placeholder="Hi {{1}}, thanks for signing up! Your order {{2}} is confirmed."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                maxLength={1024}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Formatting: *bold* _italic_ ~strikethrough~</span>
                <span>{body.length}/1024</span>
              </div>
            </div>

            {/* Variable sample values */}
            {uniqueVars.length > 0 && (
              <div className="space-y-2">
                <Label>
                  Variable Sample Values
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    shown in preview and sent as examples to Meta
                  </span>
                </Label>
                <div className="space-y-2 rounded-md border p-4">
                  {uniqueVars.map((num) => {
                    const suggestion = VARIABLE_SUGGESTIONS[num - 1];
                    return (
                      <div key={num} className="flex items-center gap-3">
                        <Badge variant="outline" className="shrink-0 font-mono text-xs w-14 justify-center">
                          {`{{${num}}}`}
                        </Badge>
                        <Input
                          className="h-8 text-sm flex-1"
                          placeholder={suggestion?.placeholder ?? `Sample value for variable ${num}`}
                          value={sampleValues[num] ?? ""}
                          onChange={(e) => setSampleValues({ ...sampleValues, [num]: e.target.value })}
                        />
                        {suggestion && !sampleValues[num] && (
                          <span className="shrink-0 text-xs text-muted-foreground">e.g. {suggestion.example}</span>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    In campaigns, variables are automatically filled with contact data (name, email, phone, etc.)
                  </p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="space-y-2">
              <Label>
                Footer
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">optional, max 60 chars</span>
              </Label>
              <Input placeholder="Optional footer text..." value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={60} className="max-w-md" />
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <Label>
                Buttons
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">optional, max 3</span>
              </Label>

              {buttons.map((btn, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2 max-w-md">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {btn.type === "URL" && "URL Button"}
                      {btn.type === "PHONE_NUMBER" && "Call Button"}
                      {btn.type === "QUICK_REPLY" && "Quick Reply"}
                    </Badge>
                    <Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => removeButton(i)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <Input placeholder="Button text (max 25 chars)..." value={btn.text} onChange={(e) => updateButton(i, { text: e.target.value })} maxLength={25} />
                  {btn.type === "URL" && <Input placeholder="https://example.com/..." value={btn.url ?? ""} onChange={(e) => updateButton(i, { url: e.target.value })} />}
                  {btn.type === "PHONE_NUMBER" && <Input placeholder="+1234567890" value={btn.phone_number ?? ""} onChange={(e) => updateButton(i, { phone_number: e.target.value })} />}
                </div>
              ))}

              {buttons.length < 3 && (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => addButton("QUICK_REPLY")}><Reply className="mr-1.5 size-3.5" /> Quick Reply</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addButton("URL")}><ExternalLink className="mr-1.5 size-3.5" /> URL</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addButton("PHONE_NUMBER")}><Phone className="mr-1.5 size-3.5" /> Call</Button>
                </div>
              )}
            </div>

            {/* Error */}
            {submitError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-destructive">Submission failed</p>
                  <p className="text-xs text-destructive/80 mt-0.5">{submitError}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: sticky preview panel */}
        <div className="hidden lg:flex flex-col border-l bg-muted/10">
          <div className="border-b px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="rounded-xl bg-[#e5ddd5] dark:bg-[#0b1410] p-4 min-h-[350px]">
              {/* Message bubble */}
              <div className="rounded-lg bg-white dark:bg-[#1f2c34] p-3 shadow-sm space-y-2">
                {/* Header media */}
                {headerFormat === "IMAGE" && (
                  <div className="flex items-center justify-center rounded bg-muted/50 dark:bg-muted/20 py-10">
                    <Image className="size-10 text-muted-foreground/50" />
                  </div>
                )}
                {headerFormat === "VIDEO" && (
                  <div className="flex items-center justify-center rounded bg-muted/50 dark:bg-muted/20 py-10">
                    <Video className="size-10 text-muted-foreground/50" />
                  </div>
                )}
                {headerFormat === "DOCUMENT" && (
                  <div className="flex items-center gap-2 rounded bg-muted/50 dark:bg-muted/20 p-3">
                    <FileText className="size-6 text-muted-foreground/50" />
                    <span className="text-xs text-muted-foreground">Document</span>
                  </div>
                )}

                {/* Header text */}
                {headerFormat === "TEXT" && headerText && (
                  <p className="text-sm font-bold text-foreground">{headerText}</p>
                )}

                {/* Body */}
                <p
                  className="text-[13px] text-foreground whitespace-pre-wrap break-words leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderPreviewBody() }}
                />

                {/* Footer */}
                {footer && <p className="text-[11px] text-muted-foreground">{footer}</p>}

                {/* Timestamp */}
                <p className="text-right text-[10px] text-muted-foreground">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              {/* Buttons */}
              {buttons.length > 0 && (
                <div className="mt-1 space-y-1">
                  {buttons.map((btn, i) => (
                    <div key={i} className="flex items-center justify-center gap-1.5 rounded-lg bg-white dark:bg-[#1f2c34] py-2.5 text-[13px] text-primary shadow-sm">
                      {btn.type === "URL" && <ExternalLink className="size-3.5" />}
                      {btn.type === "PHONE_NUMBER" && <Phone className="size-3.5" />}
                      {btn.type === "QUICK_REPLY" && <Reply className="size-3.5" />}
                      {btn.text || "Button text"}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Variable legend */}
            {uniqueVars.length > 0 && (
              <div className="mt-4 rounded-md border p-3 space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Variable Mapping</p>
                {uniqueVars.map((num) => (
                  <div key={num} className="flex justify-between text-xs">
                    <span className="font-mono text-muted-foreground">{`{{${num}}}`}</span>
                    <span className="text-foreground">{sampleValues[num] || VARIABLE_SUGGESTIONS[num - 1]?.placeholder || `Variable ${num}`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
