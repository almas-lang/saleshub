// ──────────────────────────────────────────
// Import type (contacts vs form responses)
// ──────────────────────────────────────────

export type ImportType = "contacts" | "form_responses";

// ──────────────────────────────────────────
// Mappable contact fields
// ──────────────────────────────────────────

export const MAPPABLE_FIELDS = [
  { key: "first_name", label: "First Name", required: true },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company_name", label: "Company" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "source", label: "Source" },
  { key: "tags", label: "Tags" },
  { key: "funnel_id", label: "Funnel" },
  { key: "current_stage_id", label: "Stage" },
  { key: "assigned_to", label: "Assigned To" },
  { key: "utm_source", label: "UTM Source" },
  { key: "utm_medium", label: "UTM Medium" },
  { key: "utm_campaign", label: "UTM Campaign" },
  { key: "utm_content", label: "UTM Content" },
  { key: "utm_term", label: "UTM Term" },
  { key: "converted_at", label: "Converted Date" },
  { key: "created_at", label: "Created Date" },
  { key: "metadata", label: "Metadata (extras)" },
] as const;

export type MappableFieldKey = (typeof MAPPABLE_FIELDS)[number]["key"];

// ──────────────────────────────────────────
// Mappable form response fields (Sheet 2)
// ──────────────────────────────────────────

export const FORM_RESPONSE_FIELDS = [
  { key: "email", label: "Email", required: true },
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "phone", label: "Phone" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "booked_at", label: "Booked At" },
  { key: "employment_status", label: "Employment Status" },
  { key: "work_experience", label: "Work Experience" },
  { key: "current_role", label: "Current Role / Next Role" },
  { key: "key_challenge", label: "Key Challenge" },
  { key: "desired_salary", label: "Desired Salary" },
  { key: "blocker", label: "Blocker" },
  { key: "financial_readiness", label: "Financial Readiness" },
  { key: "urgency", label: "Urgency" },
] as const;

export type FormResponseFieldKey = (typeof FORM_RESPONSE_FIELDS)[number]["key"];

// ──────────────────────────────────────────
// Import mapping (CSV column → field)
// ──────────────────────────────────────────

export type AnyFieldKey = MappableFieldKey | FormResponseFieldKey;

export interface ImportMapping {
  csvColumn: string;
  contactField: AnyFieldKey | "__skip__";
  autoDetected: boolean;
}

// ──────────────────────────────────────────
// Import configuration (contacts)
// ──────────────────────────────────────────

export type DuplicateHandling = "skip" | "update" | "create_always";

export interface ImportConfig {
  duplicate_handling: DuplicateHandling;
  normalize_phones: boolean;
  trim_whitespace: boolean;
  default_funnel_id: string;
  default_stage_id: string;
  default_assigned_to: string;
  default_source: string;
  default_tags: string[];
}

// ──────────────────────────────────────────
// Import configuration (form responses)
// ──────────────────────────────────────────

export type FormResponseDuplicateHandling = "skip" | "create_new";

export interface FormResponseConfig {
  target_funnel_id: string;
  target_stage_id: string;
  duplicate_handling: FormResponseDuplicateHandling;
  trim_whitespace: boolean;
}

// ──────────────────────────────────────────
// Parsed file data
// ──────────────────────────────────────────

export interface ParsedFile {
  name: string;
  size: number;
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

// ──────────────────────────────────────────
// API batch result
// ──────────────────────────────────────────

export interface ImportBatchResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; error: string }[];
}

// ──────────────────────────────────────────
// Overall import results (accumulated)
// ──────────────────────────────────────────

export interface ImportResults {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; error: string }[];
  totalBatches: number;
  completedBatches: number;
}

// ──────────────────────────────────────────
// Form response import results
// ──────────────────────────────────────────

export interface FormResponseBatchResult {
  matched: number;
  created: number;
  skipped: number;
  errors: { row: number; error: string }[];
}

export interface FormResponseImportResults {
  matched: number;
  created: number;
  skipped: number;
  errors: { row: number; error: string }[];
  totalBatches: number;
  completedBatches: number;
}
