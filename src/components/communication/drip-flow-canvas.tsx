"use client";

import { useCallback, useRef, useEffect } from "react";
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
import { Send, Clock, GitBranch, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nodeTypes, TemplatesContext } from "./drip-nodes";
import type {
  FlowData,
  FlowNodeData,
  CampaignStepDraft,
  WAStepDraftWithBranching,
  BranchingEdge,
  SendNodeData,
  DelayNodeData,
  ConditionNodeData,
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

export function validateFlow(flow: FlowData): boolean {
  const triggerNodes = flow.nodes.filter((n) => n.type === "trigger");
  if (triggerNodes.length !== 1) return false;

  const sendNodes = flow.nodes.filter((n) => n.type === "send");
  if (sendNodes.length === 0) return false;

  // All send nodes must have a template selected
  for (const n of sendNodes) {
    const d = n.data as SendNodeData;
    if (!d.templateName) return false;
  }

  // Check graph is connected (all nodes reachable from trigger)
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

// ── flowToSteps: walk graph to derive linear CampaignStepDraft[] ──

export function flowToSteps(flow: FlowData): CampaignStepDraft[] {
  const steps: CampaignStepDraft[] = [];
  const triggerNode = flow.nodes.find((n) => n.type === "trigger");
  if (!triggerNode) return steps;

  // Build adjacency: source -> { target, sourceHandle }
  const outgoing = new Map<string, { target: string; sourceHandle: string | null }[]>();
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

    if (node.type === "send") {
      const d = node.data as unknown as SendNodeData;
      steps.push({
        template_id: d.templateId ?? "",
        wa_template_name: d.templateName ?? "",
        delay_hours: accumulatedDelay,
        wa_template_params: d.templateParams ?? [],
      });
      accumulatedDelay = 0; // reset after emitting
    } else if (node.type === "delay") {
      const d = node.data as unknown as DelayNodeData;
      accumulatedDelay += d.hours ?? 0;
    } else if (node.type === "condition") {
      const d = node.data as unknown as ConditionNodeData;
      // Add condition to the last step if exists
      if (steps.length > 0) {
        steps[steps.length - 1].condition = { check: d.check };
      }
    } else if (node.type === "stop") {
      break;
    }

    // Find next node
    const nodeEdges: { target: string; sourceHandle: string | null }[] = outgoing.get(currentId) ?? [];
    if (node.type === "condition") {
      // Follow "no" branch to continue the sequence
      const noBranch = nodeEdges.find((e) => e.sourceHandle === "no");
      currentId = noBranch?.target ?? null;
    } else {
      currentId = nodeEdges[0]?.target ?? null;
    }
  }

  // Ensure first step has delay 0
  if (steps.length > 0) steps[0].delay_hours = 0;

  return steps;
}

// ── flowToWaStepsWithBranching: BFS walk preserving all branches ──

export function flowToWaStepsWithBranching(
  flow: FlowData
): { steps: WAStepDraftWithBranching[]; edges: BranchingEdge[] } {
  const steps: WAStepDraftWithBranching[] = [];
  const edges: BranchingEdge[] = [];

  const triggerNode = flow.nodes.find((n) => n.type === "trigger");
  if (!triggerNode) return { steps, edges };

  // Build adjacency: source -> [{ target, sourceHandle }]
  const outgoing = new Map<string, { target: string; sourceHandle: string | null }[]>();
  for (const e of flow.edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push({ target: e.target, sourceHandle: e.sourceHandle ?? null });
  }

  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));

  // BFS to visit all reachable nodes in order
  const visited = new Set<string>();
  const queue: string[] = [];

  // Seed with trigger's children
  for (const edge of outgoing.get(triggerNode.id) ?? []) {
    queue.push(edge.target);
  }
  visited.add(triggerNode.id);

  // Track delay accumulated before each node
  const delayBefore = new Map<string, number>();

  // First pass: compute delays by walking linearly from trigger
  // For branching we assign delays at the step level
  function walkDelays(nodeId: string, accumulated: number, seen: Set<string>) {
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node) return;

    if (node.type === "delay") {
      const d = node.data as unknown as DelayNodeData;
      const newAcc = accumulated + (d.hours ?? 0);
      for (const edge of outgoing.get(nodeId) ?? []) {
        walkDelays(edge.target, newAcc, seen);
      }
    } else if (node.type === "send" || node.type === "condition") {
      delayBefore.set(nodeId, accumulated);
      for (const edge of outgoing.get(nodeId) ?? []) {
        walkDelays(edge.target, 0, seen);
      }
    } else if (node.type === "stop") {
      // terminal
    } else {
      for (const edge of outgoing.get(nodeId) ?? []) {
        walkDelays(edge.target, accumulated, seen);
      }
    }
  }

  for (const edge of outgoing.get(triggerNode.id) ?? []) {
    walkDelays(edge.target, 0, new Set([triggerNode.id]));
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

    if (node.type === "send") {
      const d = node.data as unknown as SendNodeData;
      steps.push({
        node_id: node.id,
        step_type: "send",
        template_id: d.templateId ?? "",
        wa_template_name: d.templateName ?? "",
        delay_hours: delayBefore.get(nodeId) ?? 0,
        wa_template_params: d.templateParams ?? [],
      });

      // Find the next non-delay actionable node for edges
      for (const edge of outgoing.get(nodeId) ?? []) {
        const target = resolveTarget(edge.target);
        if (target) {
          edges.push({
            source_node_id: nodeId,
            target_node_id: target,
            branch: null,
          });
        }
        bfsQueue.push(edge.target);
      }
    } else if (node.type === "condition") {
      const d = node.data as unknown as ConditionNodeData;
      steps.push({
        node_id: node.id,
        step_type: "condition",
        template_id: "",
        wa_template_name: "",
        delay_hours: delayBefore.get(nodeId) ?? 0,
        wa_template_params: [],
        condition: { check: d.check },
      });

      // Follow yes and no branches
      for (const edge of outgoing.get(nodeId) ?? []) {
        const branch = edge.sourceHandle === "yes" ? "yes" : "no";
        const target = resolveTarget(edge.target);
        if (target) {
          edges.push({
            source_node_id: nodeId,
            target_node_id: target,
            branch: branch as "yes" | "no",
          });
        }
        bfsQueue.push(edge.target);
      }
    } else if (node.type === "delay") {
      // Skip delay nodes — their time is folded into the next step
      for (const edge of outgoing.get(nodeId) ?? []) {
        bfsQueue.push(edge.target);
      }
    }
    // stop nodes are terminal — nothing to emit
  }

  // Ensure first step has delay 0
  if (steps.length > 0) steps[0].delay_hours = 0;

  return { steps, edges };

  // Helper: resolve through delay nodes to find the actionable target
  function resolveTarget(nodeId: string): string | null {
    const seen = new Set<string>();
    let current = nodeId;
    while (current && !seen.has(current)) {
      seen.add(current);
      const n = nodeMap.get(current);
      if (!n) return null;
      if (n.type === "send" || n.type === "condition") return current;
      if (n.type === "stop") return null;
      // Traverse through delay nodes
      const next = outgoing.get(current)?.[0]?.target;
      if (!next) return null;
      current = next;
    }
    return null;
  }
}

// ── Connection validation ──

function isValidConnection(connection: Connection, nodes: Node[]): boolean {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return false;

  // No incoming to trigger
  if (targetNode.type === "trigger") return false;
  // No outgoing from stop
  if (sourceNode.type === "stop") return false;
  // No self-connections
  if (connection.source === connection.target) return false;

  return true;
}

// ── Inner canvas (needs ReactFlow context) ──

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

  // Debounced onChange
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

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            addNode("send", {
              nodeType: "send",
              templateId: "",
              templateName: "",
              templateParams: [],
            })
          }
        >
          <Send className="mr-1.5 size-3.5" />
          Send
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
      </div>

      {/* Canvas */}
      <div className="h-[500px] rounded-lg border bg-muted/20">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
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
}

// ── Main exported component (wraps with ReactFlowProvider) ──

interface DripFlowCanvasProps {
  templates: WizardTemplate[];
  templatesLoading: boolean;
  flowData: FlowData | null;
  onFlowChange: (flow: FlowData) => void;
}

export function DripFlowCanvas({
  templates,
  templatesLoading,
  flowData,
  onFlowChange,
}: DripFlowCanvasProps) {
  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-muted-foreground">Loading templates...</span>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No approved templates found. Create templates in your Meta Business
          account first.
        </p>
      </div>
    );
  }

  return (
    <TemplatesContext.Provider value={templates}>
      <ReactFlowProvider>
        <InnerCanvas flowData={flowData} onFlowChange={onFlowChange} />
      </ReactFlowProvider>
    </TemplatesContext.Provider>
  );
}
