"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Send, Mail, Clock, GitBranch, Square, Maximize2, Minimize2, ArrowLeft, ArrowRight, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unifiedNodeTypes, UnifiedTemplatesContext } from "./unified-drip-nodes";
import type {
  FlowData,
  FlowNodeData,
  UnifiedStepDraftWithBranching,
  UnifiedSendNodeData,
  BranchingEdge,
  DelayNodeData,
  ConditionNodeData,
  SendChannel,
} from "@/types/campaigns";
import type { WizardTemplate } from "./campaign-wizard";

// ── Default trigger node ──

const DEFAULT_TRIGGER: Node = {
  id: "trigger-1",
  type: "trigger",
  position: { x: 250, y: 30 },
  data: { nodeType: "trigger", event: "lead_created" },
  deletable: false,
};

// ── Helpers ──

let nodeIdCounter = 1;
function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${++nodeIdCounter}`;
}

function serializeFlow(nodes: Node[], edges: Edge[]): FlowData {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type!,
      position: n.position,
      data: n.data as unknown as FlowNodeData,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  };
}

// ── Validate flow ──

export function validateUnifiedFlow(flow: FlowData): boolean {
  return getUnifiedFlowErrors(flow).length === 0;
}

export function getUnifiedFlowErrors(flow: FlowData): string[] {
  const errors: string[] = [];

  const triggerNodes = flow.nodes.filter((n) => n.type === "trigger");
  if (triggerNodes.length !== 1) {
    errors.push("Flow must have exactly one Trigger node.");
    return errors;
  }

  const sendNodes = flow.nodes.filter((n) => n.type === "unified_send");
  if (sendNodes.length === 0) {
    errors.push("Add at least one Send node.");
    return errors;
  }

  for (const n of sendNodes) {
    const d = n.data as unknown as UnifiedSendNodeData;
    if (d.channel === "whatsapp" && !d.templateName) {
      errors.push("A WhatsApp send node is missing a template selection.");
    }
    if (d.channel === "email" && !d.subject && !d.bodyHtml) {
      errors.push("An Email send node has no content. Click Compose to add content.");
    }
  }

  // Check connectivity
  const adjacency = new Map<string, string[]>();
  for (const n of flow.nodes) adjacency.set(n.id, []);
  for (const e of flow.edges) {
    adjacency.get(e.source)?.push(e.target);
    adjacency.get(e.target)?.push(e.source);
  }
  const visited = new Set<string>();
  const queue = [triggerNodes[0].id];
  while (queue.length > 0) {
    const curr = queue.pop()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    for (const neighbor of adjacency.get(curr) ?? []) {
      if (!visited.has(neighbor)) queue.push(neighbor);
    }
  }
  if (visited.size !== flow.nodes.length) {
    errors.push(`${flow.nodes.length - visited.size} node(s) are not connected to the flow.`);
  }

  return errors;
}

// ── flowToUnifiedStepsWithBranching ──

export function flowToUnifiedStepsWithBranching(
  flow: FlowData
): { steps: UnifiedStepDraftWithBranching[]; edges: BranchingEdge[] } {
  const steps: UnifiedStepDraftWithBranching[] = [];
  const edges: BranchingEdge[] = [];

  const triggerNode = flow.nodes.find((n) => n.type === "trigger");
  if (!triggerNode) return { steps, edges };

  const outgoing = new Map<string, { target: string; sourceHandle: string | null }[]>();
  for (const e of flow.edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push({ target: e.target, sourceHandle: e.sourceHandle ?? null });
  }

  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));

  // Compute delays and delay modes
  const delayBefore = new Map<string, number>();
  const delayModeBefore = new Map<string, string>();
  function walkDelays(nodeId: string, accumulated: number, lastMode: string, seen: Set<string>) {
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node) return;

    if (node.type === "delay") {
      const d = node.data as unknown as DelayNodeData;
      const mode = d.delayMode ?? "after_previous";
      const newAcc = mode === "before_booking" ? (d.hours ?? 0) : accumulated + (d.hours ?? 0);
      for (const edge of outgoing.get(nodeId) ?? []) walkDelays(edge.target, newAcc, mode, seen);
    } else if (node.type === "unified_send" || node.type === "condition") {
      delayBefore.set(nodeId, accumulated);
      delayModeBefore.set(nodeId, lastMode);
      for (const edge of outgoing.get(nodeId) ?? []) walkDelays(edge.target, 0, "after_previous", seen);
    } else if (node.type !== "stop") {
      for (const edge of outgoing.get(nodeId) ?? []) walkDelays(edge.target, accumulated, lastMode, seen);
    }
  }
  for (const edge of outgoing.get(triggerNode.id) ?? []) {
    walkDelays(edge.target, 0, "after_previous", new Set([triggerNode.id]));
  }

  // Helper: resolve through delays
  function resolveTarget(nodeId: string): string | null {
    const seen = new Set<string>();
    let current = nodeId;
    while (current && !seen.has(current)) {
      seen.add(current);
      const n = nodeMap.get(current);
      if (!n) return null;
      if (n.type === "unified_send" || n.type === "condition") return current;
      if (n.type === "stop") return null;
      const next = outgoing.get(current)?.[0]?.target;
      if (!next) return null;
      current = next;
    }
    return null;
  }

  // BFS to emit steps and edges
  const emitted = new Set<string>();
  const bfsQueue = [...(outgoing.get(triggerNode.id) ?? []).map((e) => e.target)];

  while (bfsQueue.length > 0) {
    const nodeId = bfsQueue.shift()!;
    if (emitted.has(nodeId)) continue;
    emitted.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) continue;

    if (node.type === "unified_send") {
      const d = node.data as unknown as UnifiedSendNodeData;
      const channel: SendChannel = d.channel ?? "whatsapp";
      steps.push({
        node_id: node.id,
        step_type: "send",
        channel,
        delay_hours: delayBefore.get(nodeId) ?? 0,
        delay_mode: (delayModeBefore.get(nodeId) ?? "after_previous") as "after_previous" | "before_booking",
        // Email fields
        ...(channel === "email" ? {
          subject: d.subject ?? "",
          preview_text: d.previewText ?? "",
          body_html: d.bodyHtml ?? "",
        } : {}),
        // WhatsApp fields
        ...(channel === "whatsapp" ? {
          wa_template_name: d.templateName ?? "",
          wa_template_language: d.templateLanguage ?? "en",
          wa_template_params: d.templateParams ?? [],
          wa_template_param_names: d.templateParamNames ?? [],
        } : {}),
      });

      for (const edge of outgoing.get(nodeId) ?? []) {
        const target = resolveTarget(edge.target);
        if (target) edges.push({ source_node_id: nodeId, target_node_id: target, branch: null });
        bfsQueue.push(edge.target);
      }
    } else if (node.type === "condition") {
      const d = node.data as unknown as ConditionNodeData;
      steps.push({
        node_id: node.id,
        step_type: "condition",
        channel: "whatsapp", // placeholder, conditions are channel-agnostic
        delay_hours: delayBefore.get(nodeId) ?? 0,
        condition: { check: d.check },
      });

      for (const edge of outgoing.get(nodeId) ?? []) {
        const branch = edge.sourceHandle === "yes" ? "yes" : "no";
        const target = resolveTarget(edge.target);
        if (target) edges.push({ source_node_id: nodeId, target_node_id: target, branch: branch as "yes" | "no" });
        bfsQueue.push(edge.target);
      }
    } else if (node.type === "delay") {
      for (const edge of outgoing.get(nodeId) ?? []) bfsQueue.push(edge.target);
    }
  }

  if (steps.length > 0) steps[0].delay_hours = 0;
  return { steps, edges };
}

// ── Connection validation ──

function isValidConnection(connection: Connection, nodes: Node[]): boolean {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return false;
  if (targetNode.type === "trigger") return false;
  if (sourceNode.type === "stop") return false;
  if (connection.source === connection.target) return false;
  return true;
}

// ── Inner Canvas ──

interface InnerCanvasProps {
  flowData: FlowData | null;
  onFlowChange: (flow: FlowData) => void;
  onBack?: () => void;
  onContinue?: () => void;
  canContinue?: boolean;
  onSaveDraft?: () => void;
  saving?: boolean;
}

function InnerCanvas({ flowData, onFlowChange, onBack, onContinue, canContinue, onSaveDraft, saving }: InnerCanvasProps) {
  const initialNodes = flowData?.nodes?.length
    ? flowData.nodes.map((n) => ({ ...n, data: n.data as unknown as Record<string, unknown> }))
    : [DEFAULT_TRIGGER];
  const initialEdges = flowData?.edges ?? [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => { nodesRef.current = nodes; edgesRef.current = edges; });

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFlowChange(serializeFlow(nodesRef.current, edgesRef.current));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [nodes, edges, onFlowChange]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!isValidConnection(params, nodesRef.current)) return;
      setEdges((eds) =>
        addEdge(params, eds).map((e) =>
          e.source === params.source && e.target === params.target
            ? { ...e, animated: true, style: { strokeWidth: 2 } }
            : e,
        ),
      );
    },
    [setEdges],
  );

  const addNode = useCallback(
    (type: string, data: Record<string, unknown>) => {
      setNodes((nds) => {
        // Position below the lowest existing node
        let maxY = 0;
        let lastX = 400;
        for (const n of nds) {
          if (n.position.y > maxY) {
            maxY = n.position.y;
            lastX = n.position.x;
          }
        }
        const position = { x: lastX, y: maxY + 160 };
        return [...nds, { id: nextId(type), type, position, data }];
      });
    },
    [setNodes],
  );

  const [fullscreen, setFullscreen] = useState(false);

  const content = (
    <div className={fullscreen ? "fixed inset-0 z-[9999] flex flex-col bg-background" : "space-y-3"}>
      {/* Toolbar */}
      <div className={`flex flex-wrap gap-2 ${fullscreen ? "px-4 py-3 border-b" : ""}`}>
        <Button type="button" variant="outline" size="sm"
          onClick={() => addNode("unified_send", { nodeType: "unified_send", channel: "whatsapp" })}>
          <Send className="mr-1.5 size-3.5" />WhatsApp
        </Button>
        <Button type="button" variant="outline" size="sm"
          onClick={() => addNode("unified_send", { nodeType: "unified_send", channel: "email", subject: "", previewText: "", bodyHtml: "" })}>
          <Mail className="mr-1.5 size-3.5" />Email
        </Button>
        <Button type="button" variant="outline" size="sm"
          onClick={() => addNode("delay", { nodeType: "delay", hours: 24 })}>
          <Clock className="mr-1.5 size-3.5" />Wait
        </Button>
        <Button type="button" variant="outline" size="sm"
          onClick={() => addNode("condition", { nodeType: "condition", check: "booking_created" })}>
          <GitBranch className="mr-1.5 size-3.5" />Condition
        </Button>
        <Button type="button" variant="outline" size="sm"
          onClick={() => addNode("stop", { nodeType: "stop", reason: "completed" })}>
          <Square className="mr-1.5 size-3.5" />Stop
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {fullscreen && onSaveDraft && (
            <Button type="button" variant="outline" size="sm" onClick={onSaveDraft} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Save className="mr-1.5 size-3.5" />}
              Save Draft
            </Button>
          )}
          {fullscreen && onBack && (
            <Button type="button" variant="outline" size="sm" onClick={() => { setFullscreen(false); onBack(); }}>
              <ArrowLeft className="mr-1.5 size-3.5" />Back
            </Button>
          )}
          {fullscreen && onContinue && (
            <Button type="button" size="sm" onClick={() => { setFullscreen(false); onContinue(); }} disabled={!canContinue}>
              Continue<ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setFullscreen((v) => !v)}>
            {fullscreen ? <Minimize2 className="mr-1.5 size-3.5" /> : <Maximize2 className="mr-1.5 size-3.5" />}
            {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className={fullscreen ? "flex-1 min-h-0" : "h-[calc(100vh-20rem)] min-h-[400px] rounded-lg border bg-muted/20"}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          nodeTypes={unifiedNodeTypes}
          fitView
          defaultEdgeOptions={{ animated: true, type: "smoothstep", style: { strokeWidth: 2 } }}
          isValidConnection={(connection) => isValidConnection(connection as Connection, nodesRef.current)}
          deleteKeyCode={["Backspace", "Delete"]}
          className="drip-flow"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );

  return fullscreen ? createPortal(content, document.body) : content;
}

// ── Main exported component ──

interface UnifiedDripFlowCanvasProps {
  templates: WizardTemplate[];
  templatesLoading: boolean;
  flowData: FlowData | null;
  onFlowChange: (flow: FlowData) => void;
  onBack?: () => void;
  onContinue?: () => void;
  canContinue?: boolean;
  onSaveDraft?: () => void;
  saving?: boolean;
}

export function UnifiedDripFlowCanvas({
  templates,
  templatesLoading,
  flowData,
  onFlowChange,
  onBack,
  onContinue,
  canContinue = true,
  onSaveDraft,
  saving,
}: UnifiedDripFlowCanvasProps) {
  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-muted-foreground">Loading templates...</span>
      </div>
    );
  }

  return (
    <UnifiedTemplatesContext.Provider value={templates}>
      <ReactFlowProvider>
        <InnerCanvas flowData={flowData} onFlowChange={onFlowChange} onBack={onBack} onContinue={onContinue} canContinue={canContinue} onSaveDraft={onSaveDraft} saving={saving} />
      </ReactFlowProvider>
    </UnifiedTemplatesContext.Provider>
  );
}
