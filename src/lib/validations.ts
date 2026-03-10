import { z } from "zod";

// ──────────────────────────────────────────
// Auth
// ──────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginValues = z.infer<typeof loginSchema>;

// ──────────────────────────────────────────
// Contacts / Prospects
// ──────────────────────────────────────────

export const contactSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  funnel_id: z.string().uuid().optional().or(z.literal("")),
  current_stage_id: z.string().uuid().optional().or(z.literal("")),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  company_name: z.string().optional(),
  linkedin_url: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

export type ContactValues = z.infer<typeof contactSchema>;

// ──────────────────────────────────────────
// Funnels
// ──────────────────────────────────────────

export const funnelSchema = z.object({
  name: z.string().min(1, "Funnel name is required"),
  description: z.string().optional(),
  sales_type: z.enum(["vsl", "webinar", "workshop", "short_course", "direct_outreach", "custom"]),
});

export type FunnelValues = z.infer<typeof funnelSchema>;

export const funnelStageSchema = z.object({
  name: z.string().min(1, "Stage name is required"),
  order: z.number().int().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color"),
  is_terminal: z.boolean().optional(),
});

export type FunnelStageValues = z.infer<typeof funnelStageSchema>;

// ──────────────────────────────────────────
// Tasks
// ──────────────────────────────────────────

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  due_at: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  type: z.enum(["follow_up", "call", "email", "general"]).default("follow_up"),
  contact_id: z.string().uuid().optional().or(z.literal("")),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
});

export type TaskValues = z.infer<typeof taskSchema>;

// ──────────────────────────────────────────
// Activities
// ──────────────────────────────────────────

export const activitySchema = z.object({
  contact_id: z.string().uuid("Contact is required"),
  type: z.enum([
    "note", "call", "email_sent", "email_opened",
    "wa_sent", "wa_delivered", "wa_read", "stage_change",
    "booking_created", "payment_received", "invoice_sent", "form_submitted",
  ]),
  title: z.string().min(1, "Title is required"),
  body: z.string().optional(),
});

export type ActivityValues = z.infer<typeof activitySchema>;

// ──────────────────────────────────────────
// Lead Capture (Webhook)
// ──────────────────────────────────────────

export const leadCaptureSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  source: z.string().optional().default("landing_page"),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_content: z.string().optional(),
  utm_term: z.string().optional(),
  // Booking fields (from landing page call booking)
  call_booked: z.string().optional(),
  booked_at: z.string().optional(),
  // Calendly form response fields
  work_experience: z.string().optional(),
  current_role: z.string().optional(),
  key_challenge: z.string().optional(),
  desired_salary: z.string().optional(),
  blocker: z.string().optional(),
  financial_readiness: z.string().optional(),
  urgency: z.string().optional(),
  linkedin_url: z.string().optional(),
});

export type LeadCaptureValues = z.infer<typeof leadCaptureSchema>;

// ──────────────────────────────────────────
// CSV/XLSX Import
// ──────────────────────────────────────────

export const importRowSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().nullable().optional(),
  email: z.string().email("Invalid email").nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  funnel_id: z.string().uuid().nullable().optional().or(z.literal("")),
  current_stage_id: z.string().uuid().nullable().optional().or(z.literal("")),
  assigned_to: z.string().uuid().nullable().optional().or(z.literal("")),
  company_name: z.string().nullable().optional(),
  linkedin_url: z.string().url("Invalid URL").nullable().optional().or(z.literal("")),
  utm_source: z.string().nullable().optional(),
  utm_medium: z.string().nullable().optional(),
  utm_campaign: z.string().nullable().optional(),
  utm_content: z.string().nullable().optional(),
  utm_term: z.string().nullable().optional(),
  converted_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type ImportRowValues = z.infer<typeof importRowSchema>;

export const importBatchSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(50),
  config: z.object({
    duplicate_handling: z.enum(["skip", "update", "create_always"]),
    normalize_phones: z.boolean(),
    trim_whitespace: z.boolean(),
  }),
});

export type ImportBatchValues = z.infer<typeof importBatchSchema>;

// ──────────────────────────────────────────
// Form Response Import (Sheet 2 — Calendly)
// ──────────────────────────────────────────

export const importFormResponseRowSchema = z.object({
  email: z.string().email("Email is required to match a contact"),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  linkedin_url: z.string().nullable().optional(),
  booked_at: z.string().nullable().optional(),
  employment_status: z.string().nullable().optional(),
  work_experience: z.string().nullable().optional(),
  current_role: z.string().nullable().optional(),
  key_challenge: z.string().nullable().optional(),
  desired_salary: z.string().nullable().optional(),
  blocker: z.string().nullable().optional(),
  financial_readiness: z.string().nullable().optional(),
  urgency: z.string().nullable().optional(),
});

export type ImportFormResponseRowValues = z.infer<typeof importFormResponseRowSchema>;

export const importFormResponseBatchSchema = z.object({
  rows: z.array(importFormResponseRowSchema).min(1).max(50),
  config: z.object({
    target_funnel_id: z.string().uuid("Target funnel is required"),
    target_stage_id: z.string().uuid("Target stage is required"),
    duplicate_handling: z.enum(["skip", "create_new"]),
    trim_whitespace: z.boolean(),
  }),
});

export type ImportFormResponseBatchValues = z.infer<typeof importFormResponseBatchSchema>;

// ──────────────────────────────────────────
// WhatsApp Campaigns
// ──────────────────────────────────────────

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(100),
  type: z.enum(["drip", "one_time", "newsletter"]),
  audience_filter: z.object({
    source: z.string().optional(),
    funnel_id: z.string().optional(),
    stage_id: z.string().optional(),
    assigned_to: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
  steps: z.array(z.object({
    order: z.number().int().min(1),
    wa_template_name: z.string().min(1, "Template name is required"),
    template_id: z.string().optional().or(z.literal("")),
    delay_hours: z.number().int().min(0),
    wa_template_params: z.array(z.string()),
    condition: z.object({
      check: z.string(),
      value: z.string().optional(),
    }).optional(),
  })).min(1, "At least one step is required"),
  activate: z.boolean().optional(),
  flow_data: z.object({
    nodes: z.array(z.object({
      id: z.string(),
      type: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      data: z.record(z.string(), z.unknown()),
    })),
    edges: z.array(z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      sourceHandle: z.string().nullable().optional(),
      targetHandle: z.string().nullable().optional(),
    })),
  }).optional(),
});

export type CreateCampaignValues = z.infer<typeof createCampaignSchema>;

// ──────────────────────────────────────────
// Email Campaigns
// ──────────────────────────────────────────

export const createEmailCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(100),
  type: z.enum(["drip", "one_time", "newsletter"]),
  audience_filter: z.object({
    source: z.string().optional(),
    funnel_id: z.string().optional(),
    stage_id: z.string().optional(),
    assigned_to: z.string().optional(),
    tags: z.array(z.string()).optional(),
    extra_emails: z.array(z.string().email()).optional(),
  }).optional(),
  steps: z.array(z.object({
    order: z.number().int().min(1),
    subject: z.string().min(1, "Subject is required"),
    body_html: z.string().min(1, "Body is required"),
    delay_hours: z.number().int().min(0),
    condition: z.object({
      check: z.string(),
      value: z.string().optional(),
    }).optional(),
  })).min(1, "At least one step is required"),
  activate: z.boolean().optional(),
});

export type CreateEmailCampaignValues = z.infer<typeof createEmailCampaignSchema>;
