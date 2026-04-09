"use client";

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import {
  Zap, Send, Mail, Clock, GitBranch, Square, Pencil, ArrowLeft, Eye, FileDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailBlockEditor } from "./email-block-editor";
import { SubjectInputWithVariables } from "./subject-input-with-variables";
import { safeFetch } from "@/lib/fetch";
import type {
  TriggerNodeData,
  UnifiedSendNodeData,
  SendChannel,
  DelayNodeData,
  DelayUnit,
  ConditionNodeData,
  StopNodeData,
} from "@/types/campaigns";
import type { WizardTemplate } from "./campaign-wizard";

// ── Templates Context ──

export const UnifiedTemplatesContext = createContext<WizardTemplate[]>([]);

// ── Dynamic variable options ──

const VARIABLE_OPTIONS = [
  { group: "Contact", items: [
    { value: "{{first_name}}", label: "First Name" },
    { value: "{{last_name}}", label: "Last Name" },
    { value: "{{email}}", label: "Email" },
    { value: "{{phone}}", label: "Phone" },
    { value: "{{company_name}}", label: "Company Name" },
  ]},
  { group: "Booking", items: [
    { value: "{{booking_date}}", label: "Booking Date" },
    { value: "{{booking_time}}", label: "Booking Time" },
    { value: "{{booking_meet_link}}", label: "Google Meet Link" },
    { value: "{{booking_reschedule_link}}", label: "Reschedule Link" },
  ]},
];

// ── Helpers ──

function parseParams(bodyText: string | null): string[] {
  if (!bodyText) return [];
  const matches = [...bodyText.matchAll(/\{\{(\w+)\}\}/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

// ── Node Shell ──

function NodeShell({
  color,
  icon,
  label,
  children,
}: {
  color: string;
  icon: React.ReactNode;
  label: string;
  children?: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30",
    blue: "border-primary/40 bg-blue-50 dark:bg-blue-950/30",
    indigo: "border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/30",
    amber: "border-amber-500/40 bg-amber-50 dark:bg-amber-950/30",
    purple: "border-purple-500/40 bg-purple-50 dark:bg-purple-950/30",
    red: "border-red-500/40 bg-red-50 dark:bg-red-950/30",
  };
  const iconColorMap: Record<string, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue: "text-primary",
    indigo: "text-indigo-600 dark:text-indigo-400",
    amber: "text-amber-600 dark:text-amber-400",
    purple: "text-purple-600 dark:text-purple-400",
    red: "text-red-600 dark:text-red-400",
  };

  return (
    <div className={`min-w-[240px] rounded-lg border-2 p-3 shadow-sm ${colorMap[color] ?? ""}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={iconColorMap[color] ?? ""}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Trigger Node ──

function TriggerNode({ data }: NodeProps) {
  const d = data as unknown as TriggerNodeData;
  const label = d.event === "lead_created" ? "New Lead Created" : "Manual Enrollment";
  return (
    <>
      <NodeShell color="emerald" icon={<Zap className="size-4" />} label="Trigger">
        <p className="text-xs text-muted-foreground">{label}</p>
      </NodeShell>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500" />
    </>
  );
}

// ── Unified Send Node (supports both Email and WhatsApp) ──

interface EmailTemplatePick {
  id: string;
  name: string;
  subject: string;
  body_html: string;
}

function EmailComposeOverlay({
  data,
  onUpdate,
  onClose,
}: {
  data: UnifiedSendNodeData;
  onUpdate: (partial: Partial<UnifiedSendNodeData>) => void;
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Compose Email</h1>
            <p className="text-xs text-muted-foreground">{data.subject || "Untitled email"}</p>
          </div>
        </div>
        <Button onClick={onClose}>Done</Button>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_420px]">
        <div className="overflow-y-auto px-8 py-6">
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="space-y-2">
              <Label>Subject</Label>
              <SubjectInputWithVariables
                value={data.subject ?? ""}
                onChange={(v) => onUpdate({ subject: v })}
                placeholder="Email subject line..."
              />
            </div>
            <div className="space-y-2">
              <Label>Preview Text</Label>
              <Input
                placeholder="Optional preview text..."
                value={data.previewText ?? ""}
                onChange={(e) => onUpdate({ previewText: e.target.value || "" })}
                maxLength={150}
              />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <EmailBlockEditor
                content={data.bodyHtml ?? ""}
                onChange={(html) => onUpdate({ bodyHtml: html })}
                placeholder="Write your email content..."
              />
            </div>
          </div>
        </div>
        <div className="hidden lg:flex flex-col border-l bg-muted/10 min-h-0">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Eye className="size-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="rounded-lg border bg-white dark:bg-card">
              <div className="border-b px-5 py-4">
                <p className="text-base font-semibold">{data.subject || "No subject"}</p>
              </div>
              <div className="px-5 py-4">
                {data.bodyHtml ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />
                ) : (
                  <p className="text-sm text-muted-foreground italic">Start writing to see the preview...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TemplatePickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (tpl: EmailTemplatePick) => void;
}) {
  const [templates, setTemplates] = useState<EmailTemplatePick[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    safeFetch<EmailTemplatePick[]>("/api/email-templates").then((res) => {
      if (res.ok && res.data) setTemplates(res.data);
      setLoading(false);
    });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">Load from Template</DialogTitle></DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading templates...</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No email templates found.</p>
        ) : (
          <div className="space-y-1">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                onClick={() => { onSelect(tpl); onOpenChange(false); }}
              >
                <p className="text-sm font-medium truncate">{tpl.name}</p>
                <p className="text-xs text-muted-foreground truncate">{tpl.subject}</p>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UnifiedSendNode({ id, data }: NodeProps) {
  const d = data as unknown as UnifiedSendNodeData;
  const { setNodes } = useReactFlow();
  const templates = useContext(UnifiedTemplatesContext);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const channel: SendChannel = d.channel ?? "whatsapp";

  const updateData = useCallback(
    (partial: Partial<UnifiedSendNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...partial } } : n)),
      );
    },
    [id, setNodes],
  );

  const handleChannelChange = useCallback(
    (ch: SendChannel) => {
      updateData({
        channel: ch,
        // Clear the other channel's data
        ...(ch === "email"
          ? { templateId: undefined, templateName: undefined, templateParams: undefined, templateParamNames: undefined }
          : { subject: undefined, previewText: undefined, bodyHtml: undefined }),
      });
    },
    [updateData],
  );

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      const tpl = templates.find((t) => t.id === templateId);
      if (!tpl) return;
      const paramSlots = parseParams(tpl.body_text);
      updateData({
        templateId: tpl.id,
        templateName: tpl.name,
        templateLanguage: tpl.language,
        templateParams: paramSlots.map(() => ""),
        templateParamNames: paramSlots,
      });
    },
    [templates, updateData],
  );

  const handleParamChange = useCallback(
    (paramIndex: number, value: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const params = [...((n.data as unknown as UnifiedSendNodeData).templateParams ?? [])];
          params[paramIndex] = value;
          return { ...n, data: { ...n.data, templateParams: params } };
        }),
      );
    },
    [id, setNodes],
  );

  const selectedTemplate = d.templateId ? templates.find((t) => t.id === d.templateId) : null;
  const paramSlots = selectedTemplate ? parseParams(selectedTemplate.body_text) : [];
  const hasEmailContent = !!(d.subject || d.bodyHtml);

  const nodeColor = channel === "email" ? "indigo" : "blue";
  const nodeIcon = channel === "email" ? <Mail className="size-4" /> : <Send className="size-4" />;
  const nodeLabel = channel === "email" ? "Send Email" : "Send WhatsApp";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <NodeShell color={nodeColor} icon={nodeIcon} label={nodeLabel}>
        <div className="space-y-2">
          {/* Channel toggle */}
          <Tabs value={channel} onValueChange={(v) => handleChannelChange(v as SendChannel)}>
            <TabsList className="h-7 w-full">
              <TabsTrigger value="whatsapp" className="h-5 flex-1 text-[10px]">WhatsApp</TabsTrigger>
              <TabsTrigger value="email" className="h-5 flex-1 text-[10px]">Email</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* WhatsApp content */}
          {channel === "whatsapp" && (
            <>
              <Select value={d.templateId || undefined} onValueChange={handleTemplateSelect}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedTemplate?.body_text && (
                <div className="rounded bg-muted/60 p-1.5" title={selectedTemplate.body_text}>
                  <p className="line-clamp-1 text-[10px] text-muted-foreground">{selectedTemplate.body_text}</p>
                </div>
              )}

              {paramSlots.map((paramName, pi) => {
                const currentVal = d.templateParams?.[pi] ?? "";
                const isDynamic = VARIABLE_OPTIONS.some((g) => g.items.some((i) => i.value === currentVal));
                return (
                  <div key={paramName} className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">{`{{${paramName}}}`}</p>
                    <Select
                      value={isDynamic ? currentVal : "__custom__"}
                      onValueChange={(v) => handleParamChange(pi, v === "__custom__" ? "" : v)}
                    >
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select field..." /></SelectTrigger>
                      <SelectContent>
                        {VARIABLE_OPTIONS.map((group) => (
                          <SelectGroup key={group.group}>
                            <SelectLabel className="text-[10px]">{group.group}</SelectLabel>
                            {group.items.map((item) => (
                              <SelectItem key={item.value} value={item.value} className="text-xs">{item.label}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                        <SelectGroup>
                          <SelectLabel className="text-[10px]">Other</SelectLabel>
                          <SelectItem value="__custom__" className="text-xs">Custom text...</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {!isDynamic && (
                      <Input className="h-7 text-xs" placeholder="Enter static value..." value={currentVal} onChange={(e) => handleParamChange(pi, e.target.value)} />
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Email content */}
          {channel === "email" && (
            <>
              {hasEmailContent ? (
                <>
                  <p className="text-xs font-medium line-clamp-1">{d.subject || "(no subject)"}</p>
                  {d.previewText && <p className="text-[10px] text-muted-foreground line-clamp-1">{d.previewText}</p>}
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">No content yet</p>
              )}
              <div className="flex gap-1.5">
                <Button type="button" variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => setEditorOpen(true)}>
                  <Pencil className="mr-1.5 size-3" />{hasEmailContent ? "Edit" : "Compose"}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPickerOpen(true)}>
                  <FileDown className="mr-1.5 size-3" />Template
                </Button>
              </div>
            </>
          )}
        </div>

        {editorOpen && (
          <EmailComposeOverlay data={d} onUpdate={updateData} onClose={() => setEditorOpen(false)} />
        )}
        <TemplatePickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(tpl) => updateData({ subject: tpl.subject, bodyHtml: tpl.body_html })}
        />
      </NodeShell>
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </>
  );
}

// ── Delay Node ──

function toHours(value: number, unit: DelayUnit): number {
  switch (unit) {
    case "minutes": return value / 60;
    case "days": return value * 24;
    default: return value;
  }
}

function DelayNode({ id, data }: NodeProps) {
  const d = data as unknown as DelayNodeData;
  const { setNodes } = useReactFlow();
  const unit: DelayUnit = d.delayUnit ?? "hours";
  const displayValue = d.delayValue ?? d.hours ?? 24;

  const update = useCallback(
    (value: number, newUnit: DelayUnit) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, delayValue: value, delayUnit: newUnit, hours: toHours(value, newUnit) } }
            : n,
        ),
      );
    },
    [id, setNodes],
  );

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-amber-500" />
      <NodeShell color="amber" icon={<Clock className="size-4" />} label="Wait">
        <div className="flex items-center gap-2">
          <Input type="number" min={1} className="h-8 w-20 text-xs" value={displayValue}
            onChange={(e) => update(Math.max(1, parseInt(e.target.value) || 1), unit)}
            onWheel={(e) => (e.target as HTMLInputElement).blur()} />
          <Select value={unit} onValueChange={(v: DelayUnit) => update(displayValue, v)}>
            <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">mins</SelectItem>
              <SelectItem value="hours">hours</SelectItem>
              <SelectItem value="days">days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </NodeShell>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500" />
    </>
  );
}

// ── Condition Node ──

function ConditionNode({ id, data }: NodeProps) {
  const d = data as unknown as ConditionNodeData;
  const { setNodes } = useReactFlow();
  const update = useCallback(
    (check: ConditionNodeData["check"]) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, check } } : n)));
    },
    [id, setNodes],
  );
  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      <NodeShell color="purple" icon={<GitBranch className="size-4" />} label="Condition">
        <Select value={d.check} onValueChange={update}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="booking_created">Has Booking</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
          </SelectContent>
        </Select>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>Yes &#x21D9;</span><span>&#x21D8; No</span>
        </div>
      </NodeShell>
      <Handle type="source" position={Position.Bottom} id="yes" className="!bg-emerald-500" style={{ left: "30%" }} />
      <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-500" style={{ left: "70%" }} />
    </>
  );
}

// ── Stop Node ──

function StopNode({ id, data }: NodeProps) {
  const d = data as unknown as StopNodeData;
  const { setNodes } = useReactFlow();
  const update = useCallback(
    (reason: StopNodeData["reason"]) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, reason } } : n)));
    },
    [id, setNodes],
  );
  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-red-500" />
      <NodeShell color="red" icon={<Square className="size-4" />} label="Stop">
        <Select value={d.reason} onValueChange={update}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
          </SelectContent>
        </Select>
      </NodeShell>
    </>
  );
}

// ── Export node types ──

export const unifiedNodeTypes = {
  trigger: TriggerNode,
  unified_send: UnifiedSendNode,
  delay: DelayNode,
  condition: ConditionNode,
  stop: StopNode,
};
