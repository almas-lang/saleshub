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

// Enrollment type for drip campaigns
export type EnrollmentType = "new_leads" | "existing" | "both";

// Audience filter for campaign targeting
export interface AudienceFilter {
  enrollment_type?: EnrollmentType;
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
  wa_template_language?: string;
  delay_hours: number;
  wa_template_params: string[];
  wa_template_param_names?: string[];
  condition?: { check: string; value?: string };
}

// Branching-aware WA step draft (includes node mapping for graph persistence)
export interface WAStepDraftWithBranching {
  node_id: string;
  step_type: "send" | "condition";
  template_id: string;
  wa_template_name: string;
  wa_template_language?: string;
  delay_hours: number;
  wa_template_params: string[];
  wa_template_param_names?: string[];
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
  templateLanguage?: string;
  templateParams: string[];
  templateParamNames: string[];
}

export type DelayUnit = "minutes" | "hours" | "days";
export type DelayMode = "after_previous" | "before_booking";

export interface DelayNodeData {
  nodeType: "delay";
  hours: number;
  delayValue?: number;
  delayUnit?: DelayUnit;
  delayMode?: DelayMode;
}

export interface ConditionNodeData {
  nodeType: "condition";
  check: "booking_created" | "booking_noshow" | "booking_completed" | "replied" | "stage_is";
  stageId?: string;
  stageName?: string;
}

export interface StopNodeData {
  nodeType: "stop";
  reason: "completed" | "booked";
}

export interface MoveStageNodeData {
  nodeType: "move_stage";
  stageId: string;
  stageName: string;
}

export interface AddTagNodeData {
  nodeType: "add_tag";
  tag: string;
}

export type FlowNodeData =
  | TriggerNodeData
  | SendNodeData
  | DelayNodeData
  | ConditionNodeData
  | StopNodeData
  | MoveStageNodeData
  | AddTagNodeData;

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
  id?: string;
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
  previewText: string;
  bodyHtml: string;
}

// ── Unified campaign types (mixed Email + WhatsApp) ──

export type SendChannel = "email" | "whatsapp";

export interface UnifiedSendNodeData {
  nodeType: "unified_send";
  channel: SendChannel;
  // Email fields
  subject?: string;
  previewText?: string;
  bodyHtml?: string;
  // WhatsApp fields
  templateId?: string;
  templateName?: string;
  templateLanguage?: string;
  templateParams?: string[];
  templateParamNames?: string[];
}

export interface UnifiedStepDraftWithBranching {
  node_id: string;
  step_type: "send" | "condition";
  channel: SendChannel;
  delay_hours: number;
  delay_mode?: DelayMode;
  // Email payload
  subject?: string;
  preview_text?: string;
  body_html?: string;
  // WhatsApp payload
  wa_template_name?: string;
  wa_template_language?: string;
  wa_template_params?: string[];
  wa_template_param_names?: string[];
  // Condition
  condition?: { check: string; value?: string };
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
