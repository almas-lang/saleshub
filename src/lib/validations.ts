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
    include_archived: z.boolean().optional(),
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
    include_archived: z.boolean().optional(),
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

// ──────────────────────────────────────────
// Booking Pages
// ──────────────────────────────────────────

export const formFieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Label is required"),
  type: z.enum(["text", "email", "phone", "textarea", "radio", "select"]),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  defaultValue: z.string().optional(),
});

export const dayScheduleSchema = z.object({
  day: z.number().int().min(0).max(6),
  enabled: z.boolean(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
});

export const availabilityRulesSchema = z.object({
  timezone: z.string(),
  schedule: z.array(dayScheduleSchema).length(7),
  buffer_minutes: z.number().int().min(0).max(120),
  max_per_day: z.number().int().min(1).max(50),
  blocked_dates: z.array(z.string()),
  assignment_mode: z.enum(["round_robin", "specific"]),
});

export const bookingPageSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: z.string().min(1, "Slug is required").max(100),
  description: z.string().nullable().optional(),
  duration_minutes: z.number().int().min(15).max(480),
  form_fields: z.array(formFieldSchema).nullable().optional(),
  availability_rules: availabilityRulesSchema.nullable().optional(),
  assigned_to: z.array(z.string().uuid()).nullable().optional(),
  confirmation_email: z.boolean().optional(),
  confirmation_wa: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export type BookingPageValues = z.infer<typeof bookingPageSchema>;

// ──────────────────────────────────────────
// Business Profile (Settings)
// ──────────────────────────────────────────

export const businessProfileSchema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  gst_number: z.string().optional().or(z.literal("")),
  address_line1: z.string().optional().or(z.literal("")),
  address_line2: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  pincode: z.string().optional().or(z.literal("")),
  support_email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  default_sender_name: z.string().optional().or(z.literal("")),
  logo_url: z.string().optional().or(z.literal("")),
});

export type BusinessProfileValues = z.infer<typeof businessProfileSchema>;

// ──────────────────────────────────────────
// Team Members (Settings)
// ──────────────────────────────────────────

export const teamMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional().or(z.literal("")),
  role: z.enum(["admin", "sales", "marketing", "viewer"]),
});

export type TeamMemberValues = z.infer<typeof teamMemberSchema>;

// ──────────────────────────────────────────
// Invoices
// ──────────────────────────────────────────

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  sac_code: z.string().default("999293"),
  qty: z.number().min(1, "Quantity must be at least 1"),
  rate: z.number().min(0, "Rate must be positive"),
  amount: z.number(),
});

export const installmentInputSchema = z.object({
  installment_number: z.number().int().min(1).max(4),
  amount: z.number().min(0),
  due_date: z.string().min(1),
});

export const invoiceSchema = z.object({
  contact_id: z.string().uuid("Client is required"),
  items: z.array(invoiceLineItemSchema).min(1, "At least one item is required"),
  subtotal: z.number(),
  total: z.number(),
  gst_rate: z.number().default(18),
  gst_amount: z.number().default(0),
  gst_number: z.string().optional().or(z.literal("")),
  customer_state: z.string().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  type: z.enum(["invoice", "estimate"]).default("invoice"),
  is_recurring: z.boolean().optional(),
  recurrence_day: z.number().int().min(1).max(28).optional().nullable(),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
  installments: z.array(installmentInputSchema).min(2).max(4).optional(),
});

export type InvoiceValues = z.infer<typeof invoiceSchema>;

// ──────────────────────────────────────────
// Convert to Customer
// ──────────────────────────────────────────

export const convertToCustomerSchema = z.object({
  contact_id: z.string().uuid("Contact is required"),
  program_name: z.string().min(1, "Program name is required"),
  amount: z.number().nullable().optional(),
  start_date: z.string().optional().or(z.literal("")),
  sessions_total: z.number().int().min(1).nullable().optional(),
  mentor_id: z.string().uuid().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable().or(z.literal("")),
  create_invoice: z.boolean().default(false),
});

export type ConvertToCustomerValues = z.infer<typeof convertToCustomerSchema>;

// ──────────────────────────────────────────
// Finance — Expenses
// ──────────────────────────────────────────

export const expenseSchema = z.object({
  amount: z.number().min(0.01, "Amount must be positive"),
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional().or(z.literal("")),
  gst_applicable: z.boolean(),
  receipt_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  contact_id: z.string().uuid().optional().or(z.literal("")),
});

export type ExpenseValues = z.infer<typeof expenseSchema>;

// ──────────────────────────────────────────
// Finance — Ad Spend
// ──────────────────────────────────────────

export const adSpendSchema = z.object({
  platform: z.enum(["meta", "google", "linkedin", "manual"]),
  campaign_name: z.string().min(1, "Campaign name is required"),
  campaign_id: z.string().optional().or(z.literal("")),
  date: z.string().min(1, "Date is required"),
  amount: z.number().min(0, "Amount must be non-negative"),
  impressions: z.number().int().min(0),
  clicks: z.number().int().min(0),
  leads: z.number().int().min(0),
});

export type AdSpendValues = z.infer<typeof adSpendSchema>;

// ──────────────────────────────────────────
// Finance — Bank Statement Import
// ──────────────────────────────────────────

export const bankImportRowSchema = z.object({
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
  type: z.enum(["income", "expense"]),
  amount: z.number().min(0.01, "Amount must be positive"),
  category: z.string().min(1, "Category is required"),
  gst_applicable: z.boolean(),
  reference: z.string().optional(),
});

export type BankImportRowValues = z.infer<typeof bankImportRowSchema>;

export const bankImportBatchSchema = z.object({
  rows: z.array(bankImportRowSchema).min(1).max(50),
  config: z.object({
    skip_zero_amounts: z.boolean(),
  }),
});

export type BankImportBatchValues = z.infer<typeof bankImportBatchSchema>;
