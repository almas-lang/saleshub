import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/lib/supabase/types";

// Row types (what you get back from a SELECT)
export type WACampaign = Tables<"wa_campaigns">;
export type WAStep = Tables<"wa_steps">;
export type WASend = Tables<"wa_sends">;
export type WATemplate = Tables<"wa_templates">;

// Insert types (what you pass to an INSERT)
export type WACampaignInsert = TablesInsert<"wa_campaigns">;
export type WAStepInsert = TablesInsert<"wa_steps">;
export type WASendInsert = TablesInsert<"wa_sends">;

// Update types (what you pass to an UPDATE)
export type WACampaignUpdate = TablesUpdate<"wa_campaigns">;
export type WAStepUpdate = TablesUpdate<"wa_steps">;
export type WASendUpdate = TablesUpdate<"wa_sends">;

// Enum aliases
export type CampaignType = Enums<"campaign_type">;     // "drip" | "one_time" | "newsletter"
export type CampaignStatus = Enums<"campaign_status">; // "draft" | "active" | "paused" | "completed"
export type WASendStatus = Enums<"wa_send_status">;    // "queued" | "sent" | "delivered" | "read" | "failed"

// Audience filter for campaign targeting
export interface AudienceFilter {
  source?: string;
  funnel_id?: string;
  stage_id?: string;
  assigned_to?: string;
  tags?: string[];
  extra_emails?: string[];
  include_archived?: boolean;
}

// Draft step shape used in the campaign wizard
export interface CampaignStepDraft {
  template_id: string;
  wa_template_name: string;
  delay_hours: number;
  wa_template_params: string[];
  condition?: { check: string; value?: string };
}

// Branching-aware WA step draft (includes node mapping for graph persistence)
export interface WAStepDraftWithBranching {
  node_id: string;
  step_type: "send" | "condition";
  template_id: string;
  wa_template_name: string;
  delay_hours: number;
  wa_template_params: string[];
  condition?: { check: string; value?: string };
}

// ── Flow builder node data types ──

export interface TriggerNodeData {
  nodeType: "trigger";
  event: "manual" | "lead_created";
}

export interface SendNodeData {
  nodeType: "send";
  templateId: string;
  templateName: string;
  templateParams: string[];
}

export interface DelayNodeData {
  nodeType: "delay";
  hours: number;
}

export interface ConditionNodeData {
  nodeType: "condition";
  check: "booking_created" | "replied";
}

export interface StopNodeData {
  nodeType: "stop";
  reason: "completed" | "booked";
}

export type FlowNodeData =
  | TriggerNodeData
  | SendNodeData
  | DelayNodeData
  | ConditionNodeData
  | StopNodeData;

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// Campaign with aggregated send stats (for list view)
export type WACampaignWithStats = WACampaign & {
  step_count: number;
  recipient_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
};

// ── Email Campaign Types ──

// Row types
export type EmailCampaign = Tables<"email_campaigns">;
export type EmailStep = Tables<"email_steps">;
export type EmailSend = Tables<"email_sends">;

// Insert types
export type EmailCampaignInsert = TablesInsert<"email_campaigns">;
export type EmailStepInsert = TablesInsert<"email_steps">;
export type EmailSendInsert = TablesInsert<"email_sends">;

// Update types
export type EmailCampaignUpdate = TablesUpdate<"email_campaigns">;
export type EmailStepUpdate = TablesUpdate<"email_steps">;

// Enum alias
export type EmailSendStatus = Enums<"email_send_status">;

// Draft step shape used in the email campaign wizard (linear)
export interface EmailStepDraft {
  subject: string;
  preview_text?: string;
  body_html: string;
  delay_hours: number;
  condition?: { check: string; value?: string };
}

// Branching-aware step draft (includes node mapping for graph persistence)
export interface EmailStepDraftWithBranching {
  node_id: string;
  step_type: "send" | "condition";
  subject: string;
  preview_text?: string;
  body_html: string;
  delay_hours: number;
  condition?: { check: string; value?: string };
}

// Edge info for mapping branching pointers after step insertion
export interface BranchingEdge {
  source_node_id: string;
  target_node_id: string;
  branch: "yes" | "no" | null;
}

// Email-specific flow node data
export interface EmailSendNodeData {
  nodeType: "email_send";
  subject: string;
  bodyHtml: string;
}

// Joined types for communication history
export type WASendWithDetails = WASend & {
  wa_campaigns: { name: string } | null;
  wa_steps: { wa_template_name: string } | null;
};

export type EmailSendWithDetails = EmailSend & {
  email_campaigns: { name: string } | null;
  email_steps: { subject: string } | null;
};

// Email campaign with aggregated send stats (for list view)
export type EmailCampaignWithStats = EmailCampaign & {
  step_count: number;
  recipient_count: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  failed_count: number;
};
