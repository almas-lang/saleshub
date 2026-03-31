"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { Zap, Mail, Clock, GitBranch, Square, Pencil, ArrowLeft, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EmailBlockEditor } from "./email-block-editor";
import { SubjectInputWithVariables } from "./subject-input-with-variables";
import type {
  TriggerNodeData,
  EmailSendNodeData,
  DelayNodeData,
  DelayUnit,
  ConditionNodeData,
  StopNodeData,
} from "@/types/campaigns";

// ── Node wrapper ──

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
    amber: "border-amber-500/40 bg-amber-50 dark:bg-amber-950/30",
    purple: "border-purple-500/40 bg-purple-50 dark:bg-purple-950/30",
    red: "border-red-500/40 bg-red-50 dark:bg-red-950/30",
  };

  const iconColorMap: Record<string, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue: "text-primary",
    amber: "text-amber-600 dark:text-amber-400",
    purple: "text-purple-600 dark:text-purple-400",
    red: "text-red-600 dark:text-red-400",
  };

  return (
    <div
      className={`min-w-[220px] rounded-lg border-2 p-3 shadow-sm ${colorMap[color] ?? ""}`}
    >
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

// ── Email Send Node ──

function EmailComposeOverlay({
  data,
  onUpdate,
  onClose,
}: {
  data: EmailSendNodeData;
  onUpdate: (partial: Partial<EmailSendNodeData>) => void;
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Compose Email</h1>
            <p className="text-xs text-muted-foreground">
              {data.subject || "Untitled email"}
            </p>
          </div>
        </div>
        <Button onClick={onClose}>Done</Button>
      </div>

      {/* Content: editor + preview */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_420px]">
        {/* Left: scrollable editor */}
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
              <Label>
                Preview Text
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  shown in inbox before opening
                </span>
              </Label>
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

        {/* Right: sticky email preview */}
        <div className="hidden lg:flex flex-col border-l bg-muted/10 min-h-0">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Eye className="size-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Preview</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {/* Inbox preview */}
            <div className="mb-4 rounded-lg border p-3 space-y-0.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Inbox Preview</p>
              <p className="text-sm font-semibold text-foreground truncate">
                {data.subject || "No subject"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {data.previewText || (data.bodyHtml
                  ? data.bodyHtml.replace(/<[^>]*>/g, "").slice(0, 100)
                  : "No content yet..."
                )}
              </p>
            </div>

            {/* Email body preview */}
            <div className="rounded-lg border bg-white dark:bg-card">
              {/* Email header */}
              <div className="border-b px-5 py-4">
                <p className="text-base font-semibold text-foreground">
                  {data.subject || "No subject"}
                </p>
              </div>

              {/* Email body */}
              <div className="px-5 py-4">
                {data.bodyHtml ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Start writing to see the preview...
                  </p>
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

function EmailSendNode({ id, data }: NodeProps) {
  const d = data as unknown as EmailSendNodeData;
  const { setNodes } = useReactFlow();
  const [editorOpen, setEditorOpen] = useState(false);

  const updateData = useCallback(
    (partial: Partial<EmailSendNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...partial } } : n,
        ),
      );
    },
    [id, setNodes],
  );

  const hasContent = !!(d.subject || d.bodyHtml);

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <NodeShell color="blue" icon={<Mail className="size-4" />} label="Send Email">
        <div className="space-y-1.5">
          {hasContent ? (
            <>
              <p className="text-xs font-medium line-clamp-1">
                {d.subject || "(no subject)"}
              </p>
              {d.previewText && (
                <p className="text-[10px] text-muted-foreground line-clamp-1">
                  {d.previewText}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">No content yet</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 h-7 w-full text-xs"
            onClick={() => setEditorOpen(true)}
          >
            <Pencil className="mr-1.5 size-3" />
            {hasContent ? "Edit Email" : "Compose Email"}
          </Button>
        </div>

        {editorOpen && (
          <EmailComposeOverlay
            data={d}
            onUpdate={updateData}
            onClose={() => setEditorOpen(false)}
          />
        )}
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
            ? {
                ...n,
                data: {
                  ...n.data,
                  delayValue: value,
                  delayUnit: newUnit,
                  hours: toHours(value, newUnit),
                },
              }
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
          <Input
            type="number"
            min={1}
            className="h-8 w-20 text-xs"
            value={displayValue}
            onChange={(e) =>
              update(Math.max(1, parseInt(e.target.value) || 1), unit)
            }
          />
          <Select value={unit} onValueChange={(v: DelayUnit) => update(displayValue, v)}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
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
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, check } } : n,
        ),
      );
    },
    [id, setNodes],
  );

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      <NodeShell
        color="purple"
        icon={<GitBranch className="size-4" />}
        label="Condition"
      >
        <Select value={d.check} onValueChange={update}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="booking_created">Has Booking</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
          </SelectContent>
        </Select>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>Yes &#x21D9;</span>
          <span>&#x21D8; No</span>
        </div>
      </NodeShell>
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        className="!bg-emerald-500"
        style={{ left: "30%" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        className="!bg-red-500"
        style={{ left: "70%" }}
      />
    </>
  );
}

// ── Stop Node ──

function StopNode({ id, data }: NodeProps) {
  const d = data as unknown as StopNodeData;
  const { setNodes } = useReactFlow();

  const update = useCallback(
    (reason: StopNodeData["reason"]) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, reason } } : n,
        ),
      );
    },
    [id, setNodes],
  );

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-red-500" />
      <NodeShell color="red" icon={<Square className="size-4" />} label="Stop">
        <Select value={d.reason} onValueChange={update}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
          </SelectContent>
        </Select>
      </NodeShell>
    </>
  );
}

// ── Node types export ──

export const emailNodeTypes = {
  trigger: TriggerNode,
  email_send: EmailSendNode,
  delay: DelayNode,
  condition: ConditionNode,
  stop: StopNode,
};
