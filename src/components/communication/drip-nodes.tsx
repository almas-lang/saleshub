"use client";

import { createContext, useContext, useCallback } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { Zap, Send, Clock, GitBranch, Square } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  TriggerNodeData,
  SendNodeData,
  DelayNodeData,
  DelayUnit,
  ConditionNodeData,
  StopNodeData,
} from "@/types/campaigns";
import type { WizardTemplate } from "./campaign-wizard";

// ── Templates Context ──

export const TemplatesContext = createContext<WizardTemplate[]>([]);

// ── Helper: parse {{n}} params from body text ──

function parseParams(bodyText: string | null): number[] {
  if (!bodyText) return [];
  const matches = bodyText.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => parseInt(m.replace(/\D/g, ""))))].sort(
    (a, b) => a - b,
  );
}

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

// ── Send Node ──

function SendNode({ id, data }: NodeProps) {
  const d = data as unknown as SendNodeData;
  const { setNodes } = useReactFlow();
  const templates = useContext(TemplatesContext);

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      const tpl = templates.find((t) => t.id === templateId);
      if (!tpl) return;
      const paramSlots = parseParams(tpl.body_text);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  templateId: tpl.id,
                  templateName: tpl.name,
                  templateParams: paramSlots.map(() => ""),
                },
              }
            : n,
        ),
      );
    },
    [id, setNodes, templates],
  );

  const handleParamChange = useCallback(
    (paramIndex: number, value: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const params = [...((n.data as unknown as SendNodeData).templateParams ?? [])];
          params[paramIndex] = value;
          return { ...n, data: { ...n.data, templateParams: params } };
        }),
      );
    },
    [id, setNodes],
  );

  const selectedTemplate = d.templateId
    ? templates.find((t) => t.id === d.templateId)
    : null;
  const paramSlots = selectedTemplate ? parseParams(selectedTemplate.body_text) : [];

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <NodeShell color="blue" icon={<Send className="size-4" />} label="Send">
        <div className="space-y-2">
          <Select
            value={d.templateId || undefined}
            onValueChange={handleTemplateSelect}
          >
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
            <div className="rounded bg-muted/60 p-2" title={selectedTemplate.body_text}>
              <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                {selectedTemplate.body_text}
              </p>
            </div>
          )}

          {paramSlots.map((paramNum, pi) => (
            <Input
              key={paramNum}
              className="h-7 text-xs"
              placeholder={`{{${paramNum}}}`}
              value={d.templateParams?.[pi] ?? ""}
              onChange={(e) => handleParamChange(pi, e.target.value)}
            />
          ))}
        </div>
      </NodeShell>
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </>
  );
}

// ── Delay Node ──

function toHours(value: number, unit: DelayUnit): number {
  switch (unit) {
    case "minutes": return Math.round((value / 60) * 100) / 100;
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
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
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
          <span>Yes ↙</span>
          <span>↘ No</span>
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

export const nodeTypes = {
  trigger: TriggerNode,
  send: SendNode,
  delay: DelayNode,
  condition: ConditionNode,
  stop: StopNode,
};
