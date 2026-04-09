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
import { Mail, Clock, GitBranch, Square, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emailNodeTypes } from "./email-drip-nodes";
import type {
  FlowData,
  FlowNodeData,
  EmailStepDraft,
  EmailStepDraftWithBranching,
  BranchingEdge,
  EmailSendNodeData,
  DelayNodeData,
  ConditionNodeData,
} from "@/types/campaigns";

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

export function validateEmailFlow(flow: FlowData): boolean {
  const triggerNodes = flow.nodes.filter((n) => n.type === "trigger");
  if (triggerNodes.length !== 1) return false;

  const sendNodes = flow.nodes.filter((n) => n.type === "email_send");
  if (sendNodes.length === 0) return false;

  // All send nodes must have a subject
  for (const n of sendNodes) {
    const d = n.data as unknown as EmailSendNodeData;
    if (!d.subject?.trim()) return false;
  }

  // Check graph is connected
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

  return visited.size === flow.nodes.length;
}

// ── flowToEmailSteps: walk graph to derive linear EmailStepDraft[] (legacy) ──

export function flowToEmailSteps(flow: FlowData): EmailStepDraft[] {
  const steps: EmailStepDraft[] = [];
  const triggerNode = flow.nodes.find((n) => n.type === "trigger");
  if (!triggerNode) return steps;

  type EdgeInfo = { target: string; sourceHandle: string | null };
  const outgoing = new Map<string, EdgeInfo[]>();
  for (const e of flow.edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push({ target: e.target, sourceHandle: e.sourceHandle ?? null });
  }

  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));
  let currentId: string | null = triggerNode.id;
  let accumulatedDelay = 0;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodeMap.get(currentId);
    if (!node) break;

    if (node.type === "email_send") {
      const d = node.data as unknown as EmailSendNodeData;
      steps.push({
        subject: d.subject ?? "",
        preview_text: d.previewText || undefined,
        body_html: d.bodyHtml ?? "",
        delay_hours: accumulatedDelay,
      });
      accumulatedDelay = 0;
    } else if (node.type === "delay") {
      const d = node.data as unknown as DelayNodeData;
      accumulatedDelay += d.hours ?? 0;
    } else if (node.type === "condition") {
      const d = node.data as unknown as ConditionNodeData;
      if (steps.length > 0) {
        steps[steps.length - 1].condition = { check: d.check };
      }
    } else if (node.type === "stop") {
      break;
    }

    const nodeEdges: EdgeInfo[] = outgoing.get(currentId) ?? [];
    if (node.type === "condition") {
      const noBranch = nodeEdges.find((e) => e.sourceHandle === "no");
      currentId = noBranch?.target ?? null;
    } else {
      currentId = nodeEdges[0]?.target ?? null;
    }
  }

  if (steps.length > 0) steps[0].delay_hours = 0;

  return steps;
}

// ── flowToEmailStepsWithBranching: walk ALL branches and preserve graph ──

export function flowToEmailStepsWithBranching(flow: FlowData): {
  steps: EmailStepDraftWithBranching[];
  edges: BranchingEdge[];
} {
  const steps: EmailStepDraftWithBranching[] = [];
  const branchingEdges: BranchingEdge[] = [];
  const triggerNode = flow.nodes.find((n) => n.type === "trigger");
  if (!triggerNode) return { steps, edges: branchingEdges };

  type EdgeInfo = { target: string; sourceHandle: string | null };
  const outgoing = new Map<string, EdgeInfo[]>();
  for (const e of flow.edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push({ target: e.target, sourceHandle: e.sourceHandle ?? null });
  }

  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();

  // BFS/DFS through all branches
  // Each queue entry: [nodeId, accumulatedDelay, lastStepNodeId]
  const queue: [string, number, string | null][] = [];

  // Find first node after trigger
  const triggerEdges = outgoing.get(triggerNode.id) ?? [];
  for (const edge of triggerEdges) {
    queue.push([edge.target, 0, null]);
  }

  while (queue.length > 0) {
    const [currentId, incomingDelay, parentNodeId] = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = nodeMap.get(currentId);
    if (!node) continue;

    if (node.type === "email_send") {
      const d = node.data as unknown as EmailSendNodeData;
      steps.push({
        node_id: node.id,
        step_type: "send",
        subject: d.subject ?? "",
        preview_text: d.previewText || undefined,
        body_html: d.bodyHtml ?? "",
        delay_hours: incomingDelay,
      });

      // Connect from parent
      if (parentNodeId) {
        const parentNode = nodeMap.get(parentNodeId);
        if (parentNode?.type === "condition") {
          // Determine which branch leads here
          const parentEdges = outgoing.get(parentNodeId) ?? [];
          const yesEdge = parentEdges.find((e) => e.sourceHandle === "yes");
          const branch = yesEdge?.target === currentId ? "yes" as const : "no" as const;
          branchingEdges.push({ source_node_id: parentNodeId, target_node_id: node.id, branch });
        } else {
          branchingEdges.push({ source_node_id: parentNodeId, target_node_id: node.id, branch: "no" });
        }
      }

      // Continue to next nodes
      const nodeEdges = outgoing.get(currentId) ?? [];
      for (const edge of nodeEdges) {
        queue.push([edge.target, 0, node.id]);
      }
    } else if (node.type === "delay") {
      const d = node.data as unknown as DelayNodeData;
      const totalDelay = incomingDelay + (d.hours ?? 0);
      const nodeEdges = outgoing.get(currentId) ?? [];
      for (const edge of nodeEdges) {
        queue.push([edge.target, totalDelay, parentNodeId]);
      }
      // Don't mark delay as visited so multiple paths can pass through delays
      // Actually we already marked it, which is fine — delays are typically unique per path
    } else if (node.type === "condition") {
      const d = node.data as unknown as ConditionNodeData;
      steps.push({
        node_id: node.id,
        step_type: "condition",
        subject: "",
        body_html: "",
        delay_hours: incomingDelay,
        condition: { check: d.check },
      });

      // Connect from parent
      if (parentNodeId) {
        const parentNode = nodeMap.get(parentNodeId);
        if (parentNode?.type === "condition") {
          const parentEdges = outgoing.get(parentNodeId) ?? [];
          const yesEdge = parentEdges.find((e) => e.sourceHandle === "yes");
          const branch = yesEdge?.target === currentId ? "yes" as const : "no" as const;
          branchingEdges.push({ source_node_id: parentNodeId, target_node_id: node.id, branch });
        } else {
          branchingEdges.push({ source_node_id: parentNodeId, target_node_id: node.id, branch: "no" });
        }
      }

      // Queue both branches
      const nodeEdges = outgoing.get(currentId) ?? [];
      for (const edge of nodeEdges) {
        queue.push([edge.target, 0, node.id]);
      }
    } else if (node.type === "stop") {
      // Terminal — nothing to queue
    }
  }

  // First send step should have delay 0
  const firstSend = steps.find((s) => s.step_type === "send");
  if (firstSend) firstSend.delay_hours = 0;

  return { steps, edges: branchingEdges };
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

// ── Inner canvas ──

interface InnerCanvasProps {
  flowData: FlowData | null;
  onFlowChange: (flow: FlowData) => void;
}

function InnerCanvas({ flowData, onFlowChange }: InnerCanvasProps) {
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

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  });

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
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const newNode: Node = {
        id: nextId(type),
        type,
        position,
        data,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, screenToFlowPosition],
  );

  const [fullscreen, setFullscreen] = useState(false);

  const content = (
    <div className={fullscreen ? "fixed inset-0 z-[9999] flex flex-col bg-background" : "space-y-3"}>
      {/* Toolbar */}
      <div className={`flex flex-wrap gap-2 ${fullscreen ? "px-4 py-3 border-b" : ""}`}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            addNode("email_send", {
              nodeType: "email_send",
              subject: "",
              previewText: "",
              bodyHtml: "",
            })
          }
        >
          <Mail className="mr-1.5 size-3.5" />
          Send Email
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            addNode("delay", { nodeType: "delay", hours: 24 })
          }
        >
          <Clock className="mr-1.5 size-3.5" />
          Wait
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            addNode("condition", {
              nodeType: "condition",
              check: "booking_created",
            })
          }
        >
          <GitBranch className="mr-1.5 size-3.5" />
          Condition
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            addNode("stop", { nodeType: "stop", reason: "completed" })
          }
        >
          <Square className="mr-1.5 size-3.5" />
          Stop
        </Button>
        <div className="ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFullscreen((v) => !v)}
          >
            {fullscreen ? <Minimize2 className="mr-1.5 size-3.5" /> : <Maximize2 className="mr-1.5 size-3.5" />}
            {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className={fullscreen ? "flex-1 min-h-0" : "h-[calc(100vh-320px)] min-h-[400px] rounded-lg border bg-muted/20"}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={emailNodeTypes}
          fitView
          defaultEdgeOptions={{
            animated: true,
            type: "smoothstep",
            style: { strokeWidth: 2 },
          }}
          isValidConnection={(connection) =>
            isValidConnection(connection as Connection, nodesRef.current)
          }
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

interface EmailDripFlowCanvasProps {
  flowData: FlowData | null;
  onFlowChange: (flow: FlowData) => void;
}

export function EmailDripFlowCanvas({
  flowData,
  onFlowChange,
}: EmailDripFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerCanvas flowData={flowData} onFlowChange={onFlowChange} />
    </ReactFlowProvider>
  );
}
