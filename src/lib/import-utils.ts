import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  importRowSchema,
  importFormResponseRowSchema,
  type ImportRowValues,
  type ImportFormResponseRowValues,
} from "@/lib/validations";
import type {
  ImportMapping,
  ImportConfig,
  MappableFieldKey,
  AnyFieldKey,
  FormResponseFieldKey,
  FormResponseConfig,
  ParsedFile,
} from "@/types/import";

// ──────────────────────────────────────────
// File parsing
// ──────────────────────────────────────────

export function parseCSVFile(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const rows = results.data as Record<string, string>[];
        const headers = results.meta.fields ?? [];
        resolve({
          name: file.name,
          size: file.size,
          headers,
          rows,
          totalRows: rows.length,
        });
      },
      error(err) {
        reject(new Error(err.message));
      },
    });
  });
}

export function parseXLSXFile(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: "",
          raw: false,
        });
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        resolve({
          name: file.name,
          size: file.size,
          headers,
          rows,
          totalRows: rows.length,
        });
      } catch {
        reject(new Error("Failed to parse XLSX file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

// ──────────────────────────────────────────
// Auto-mapping synonyms
// ──────────────────────────────────────────

const SYNONYM_MAP: Record<string, MappableFieldKey> = {
  // first_name
  "first name": "first_name",
  "first_name": "first_name",
  "firstname": "first_name",
  "fname": "first_name",
  "name": "first_name",
  "prenom": "first_name",
  // last_name
  "last name": "last_name",
  "last_name": "last_name",
  "lastname": "last_name",
  "lname": "last_name",
  "surname": "last_name",
  // email
  "email": "email",
  "email address": "email",
  "email_address": "email",
  "e-mail": "email",
  "mail": "email",
  // phone
  "phone": "phone",
  "phone number": "phone",
  "phone_number": "phone",
  "mobile": "phone",
  "mobile number": "phone",
  "tel": "phone",
  "telephone": "phone",
  "whatsapp": "phone",
  // company
  "company": "company_name",
  "company name": "company_name",
  "company_name": "company_name",
  "organisation": "company_name",
  "organization": "company_name",
  // linkedin
  "linkedin": "linkedin_url",
  "linkedin url": "linkedin_url",
  "linkedin_url": "linkedin_url",
  "linkedin link": "linkedin_url",
  // source
  "source": "source",
  "lead source": "source",
  "lead_source": "source",
  "origin": "source",
  // tags
  "tags": "tags",
  "tag": "tags",
  "labels": "tags",
  "label": "tags",
  // utm
  "utm_source": "utm_source",
  "utm source": "utm_source",
  "utmsource": "utm_source",
  "utm_medium": "utm_medium",
  "utm medium": "utm_medium",
  "utmmedium": "utm_medium",
  "utm_campaign": "utm_campaign",
  "utm campaign": "utm_campaign",
  "utmcampaign": "utm_campaign",
  "utm_content": "utm_content",
  "utm content": "utm_content",
  "utmcontent": "utm_content",
  "utm_term": "utm_term",
  "utm term": "utm_term",
  "utmterm": "utm_term",
  // converted
  "converted_at": "converted_at",
  "converted at": "converted_at",
  "converted date": "converted_at",
  "converted date & time": "converted_at",
  "conversion date": "converted_at",
  // created_at
  "timestamp": "created_at",
  "created at": "created_at",
  "created_at": "created_at",
  "date created": "created_at",
  // metadata (watch link)
  "watch link": "metadata",
  "watch_link": "metadata",
  "watchlink": "metadata",
  "watch url": "metadata",
  // metadata (call booked)
  "callbooked": "metadata",
  "call booked": "metadata",
  "call_booked": "metadata",
  "booked": "metadata",
  // metadata (booked at)
  "booked at": "metadata",
  "booked_at": "metadata",
  "bookedat": "metadata",
  // metadata (calendly)
  "calendlyevent": "metadata",
  "calendly event": "metadata",
  "calendly_event": "metadata",
  "calendly link": "metadata",
  "calendly_link": "metadata",
};

export function autoMapColumns(headers: string[]): ImportMapping[] {
  const usedFields = new Set<string>();

  return headers.map((header) => {
    const normalized = header.toLowerCase().trim();
    const match = SYNONYM_MAP[normalized];

    if (match && (!usedFields.has(match) || match === "metadata")) {
      usedFields.add(match);
      return {
        csvColumn: header,
        contactField: match,
        autoDetected: true,
      };
    }

    return {
      csvColumn: header,
      contactField: "__skip__" as const,
      autoDetected: false,
    };
  });
}

// ──────────────────────────────────────────
// Date parsing for CSV imports
// ──────────────────────────────────────────

const DATE_FIELDS = new Set<string>(["created_at", "converted_at"]);

/** Convert an Excel serial date number to an ISO 8601 string. */
function excelSerialToISO(serial: number): string | undefined {
  // Excel epoch = Jan 1 1900, but with the known leap-year bug (off by 1 for dates after Feb 28 1900).
  // 25569 = days between 1900-01-01 and 1970-01-01 (Unix epoch).
  const MS_PER_DAY = 86_400_000;
  const date = new Date((serial - 25569) * MS_PER_DAY);
  if (isNaN(date.getTime()) || date.getFullYear() < 1970 || date.getFullYear() > 2100) {
    return undefined;
  }
  return date.toISOString();
}

/**
 * Parse common date formats into an ISO 8601 string.
 * Handles: ISO, DD/MM/YYYY, DD/MM/YYYY HH:mm:ss, and Excel serial numbers.
 * Treats ambiguous DD/MM vs MM/DD as day-first.
 * Returns the raw string as-is if local parsing fails, so the server can retry.
 */
function parseDateString(raw: string): string | undefined {
  if (!raw) return undefined;
  const str = raw.trim();
  if (!str) return undefined;

  // Excel serial date number (e.g. 45985.0252430556)
  if (/^\d{4,6}(\.\d+)?$/.test(str)) {
    const serial = Number(str);
    if (serial > 0) {
      const result = excelSerialToISO(serial);
      if (result) return result;
    }
  }

  // ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss) — unambiguous, parse natively
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const native = new Date(str);
    if (!isNaN(native.getTime()) && native.getFullYear() >= 1970 && native.getFullYear() <= 2100) {
      return native.toISOString();
    }
  }

  // DD/MM/YYYY HH:mm(:ss) with any common separator
  const withTime = str.match(
    /^(\d{1,2})[/\-:.](\d{1,2})[/\-:.](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (withTime) {
    const [, d, m, y, h, min, sec] = withTime;
    const day = Number(d), month = Number(m), year = Number(y);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(Number(h)).padStart(2, "0")}:${min}:${sec || "00"}Z`;
      const date = new Date(iso);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
  }

  // DD/MM/YYYY date-only with any common separator
  const dmy = str.match(/^(\d{1,2})[/\-:.](\d{1,2})[/\-:.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const day = Number(d), month = Number(m), year = Number(y);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`;
      const date = new Date(iso);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
  }

  // Nothing matched locally — return raw string so the server-side parser can retry
  return str;
}

// ──────────────────────────────────────────
// Apply mappings to raw rows
// ──────────────────────────────────────────

export function applyMappings(
  rawRows: Record<string, string>[],
  mappings: ImportMapping[],
  config: ImportConfig
): Record<string, unknown>[] {
  const activeMappings = mappings.filter((m) => m.contactField !== "__skip__");

  return rawRows.map((row) => {
    const mapped: Record<string, unknown> = {};

    for (const mapping of activeMappings) {
      const value = row[mapping.csvColumn];
      const trimmed = config.trim_whitespace ? value?.trim() : value;

      if (mapping.contactField === "metadata") {
        if (!mapped.metadata) mapped.metadata = {};
        (mapped.metadata as Record<string, string>)[mapping.csvColumn] = trimmed || "";
      } else if (mapping.contactField === "tags") {
        const tags = trimmed
          ? trimmed.split(",").map((t) => t.trim()).filter(Boolean)
          : [];
        mapped.tags = tags;
      } else if (DATE_FIELDS.has(mapping.contactField)) {
        mapped[mapping.contactField] = parseDateString(trimmed ?? "") ?? undefined;
      } else {
        mapped[mapping.contactField] = trimmed || undefined;
      }
    }

    // Apply defaults where mapped value is empty
    if (!mapped.funnel_id && config.default_funnel_id) {
      mapped.funnel_id = config.default_funnel_id;
    }
    if (!mapped.current_stage_id && config.default_stage_id) {
      mapped.current_stage_id = config.default_stage_id;
    }
    if (!mapped.assigned_to && config.default_assigned_to) {
      mapped.assigned_to = config.default_assigned_to;
    }
    if (!mapped.source && config.default_source) {
      mapped.source = config.default_source;
    }
    if (
      config.default_tags.length > 0 &&
      (!mapped.tags || (mapped.tags as string[]).length === 0)
    ) {
      mapped.tags = config.default_tags;
    }

    return mapped;
  });
}

// ──────────────────────────────────────────
// Validate mapped rows
// ──────────────────────────────────────────

export interface ValidationResult {
  valid: { index: number; data: ImportRowValues }[];
  invalid: { index: number; errors: string[] }[];
}

export function validateMappedRows(
  rows: Record<string, unknown>[]
): ValidationResult {
  const valid: ValidationResult["valid"] = [];
  const invalid: ValidationResult["invalid"] = [];

  rows.forEach((row, index) => {
    const result = importRowSchema.safeParse(row);
    if (result.success) {
      valid.push({ index, data: result.data });
    } else {
      const errors = result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      invalid.push({ index, errors });
    }
  });

  return { valid, invalid };
}

// ──────────────────────────────────────────
// Chunk array into batches
// ──────────────────────────────────────────

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ══════════════════════════════════════════
// Form Response Import (Sheet 2 — Calendly)
// ══════════════════════════════════════════

const FORM_RESPONSE_SYNONYM_MAP: Record<string, FormResponseFieldKey> = {
  // email (required for matching)
  "email": "email",
  "email address": "email",
  "email_address": "email",
  "e-mail": "email",
  "mail": "email",
  // contact fields
  "first name": "first_name",
  "first_name": "first_name",
  "firstname": "first_name",
  "fname": "first_name",
  "name": "first_name",
  "last name": "last_name",
  "last_name": "last_name",
  "lastname": "last_name",
  "lname": "last_name",
  "phone": "phone",
  "phone number": "phone",
  "phone_number": "phone",
  "mobile": "phone",
  "linkedin": "linkedin_url",
  "linkedin url": "linkedin_url",
  "linkedin_url": "linkedin_url",
  // booked at (Excel serial date or date string)
  "booked at": "booked_at",
  "booked_at": "booked_at",
  "bookedat": "booked_at",
  "booking date": "booked_at",
  "booking time": "booked_at",
  "scheduled at": "booked_at",
  // employment status (old form: "Employment" column — Fresher, Full-time employee, etc.)
  "employment": "employment_status",
  "employment status": "employment_status",
  "employment_status": "employment_status",
  "employment type": "employment_status",
  // work experience (old form: "Experience" column — None, 3-5 years; new form: "total work experience")
  "work experience": "work_experience",
  "work_experience": "work_experience",
  "total work experience": "work_experience",
  "experience": "work_experience",
  "years of experience": "work_experience",
  // current role / next role (old form: "Next role"; new form: "current role")
  "current role": "current_role",
  "current_role": "current_role",
  "what is your current role": "current_role",
  "role": "current_role",
  "designation": "current_role",
  "next role": "current_role",
  "next_role": "current_role",
  "desired role": "current_role",
  // key challenge (old form: "Challenge"; new form: "key challenges")
  "challenge": "key_challenge",
  "key challenge": "key_challenge",
  "key_challenge": "key_challenge",
  "what are the key challenges": "key_challenge",
  "challenges": "key_challenge",
  "key challenges": "key_challenge",
  // desired salary
  "desired salary": "desired_salary",
  "desired_salary": "desired_salary",
  "what is the desired salary": "desired_salary",
  "expected salary": "desired_salary",
  "salary": "desired_salary",
  // blocker
  "blocker": "blocker",
  "what's stopping you": "blocker",
  "whats stopping you": "blocker",
  "what is stopping you": "blocker",
  "if you're being 100% honest": "blocker",
  "if you're being 100% honest with yourself, what's stopping you from landing your dream job or reaching your full potential": "blocker",
  "if you're being 100% honest, what's stopping you from growing into senior and design leaders": "blocker",
  "stopping you": "blocker",
  "100% honest": "blocker",
  "holding you back": "blocker",
  "what's holding you": "blocker",
  // financial readiness (not in old form — only new form)
  "financial readiness": "financial_readiness",
  "financial_readiness": "financial_readiness",
  "which of these best describes your current financial": "financial_readiness",
  "which of these best describes your current financial situation for investing in your career growth": "financial_readiness",
  "financial situation": "financial_readiness",
  "financial situation for investing": "financial_readiness",
  "financial": "financial_readiness",
  "investment readiness": "financial_readiness",
  // urgency (not in old form — only new form)
  "urgency": "urgency",
  "how soon you are ready": "urgency",
  "how soon are you ready": "urgency",
  "how soon you are ready to start working on improving your career challenges": "urgency",
  "how soon you are ready to start": "urgency",
  "readiness": "urgency",
  "timeline": "urgency",
  "how soon": "urgency",
  "ready to start": "urgency",
};

export function autoMapFormResponseColumns(headers: string[]): ImportMapping[] {
  const usedFields = new Set<string>();

  // Log headers for debugging mapping issues
  console.log("[Form Response Import] CSV headers:", headers);

  const result = headers.map((header) => {
    // Normalize: lowercase, trim, straight quotes, collapse whitespace
    const normalized = header
      .toLowerCase()
      .trim()
      .replace(/[\u2018\u2019\u2032]/g, "'")   // smart single quotes → straight
      .replace(/[\u201C\u201D\u2033]/g, '"')    // smart double quotes → straight
      .replace(/\s+/g, " ");                     // collapse whitespace

    // Try exact match first
    let match = FORM_RESPONSE_SYNONYM_MAP[normalized];

    // Try partial match for long Calendly headers (substring matching)
    if (!match) {
      for (const [synonym, field] of Object.entries(FORM_RESPONSE_SYNONYM_MAP)) {
        if (synonym.length > 10 && normalized.includes(synonym)) {
          match = field;
          break;
        }
      }
    }

    // Fallback: keyword-based matching for common field identifiers
    if (!match) {
      if (/\bdesired.?\s*salary\b/.test(normalized) || /\bsalary.?\s*you\b/.test(normalized) || /\bexpected.?\s*salary\b/.test(normalized)) {
        match = "desired_salary";
      } else if (/\bfinancial\b/.test(normalized) && (/\bsituation\b/.test(normalized) || /\breadiness\b/.test(normalized) || /\binvest\b/.test(normalized) || /\bgrowth\b/.test(normalized))) {
        match = "financial_readiness";
      } else if (/\bhow\s+soon\b/.test(normalized) || (/\bready\b/.test(normalized) && /\bstart\b/.test(normalized)) || (/\burgency\b/.test(normalized) || /\btimeline\b/.test(normalized))) {
        match = "urgency";
      } else if (/\bstopping\s+you\b/.test(normalized) || /\b100%\s*honest\b/.test(normalized) || /\bwhat.?s\s+stopping\b/.test(normalized) || /\bholding\s+you\b/.test(normalized)) {
        match = "blocker";
      }
    }

    if (match && !usedFields.has(match)) {
      usedFields.add(match);
      console.log(`[Form Response Import] Mapped: "${header}" → ${match}`);
      return {
        csvColumn: header,
        contactField: match as AnyFieldKey,
        autoDetected: true,
      };
    }

    if (!match) {
      console.log(`[Form Response Import] SKIPPED (no match): "${header}"`);
    }

    return {
      csvColumn: header,
      contactField: "__skip__" as const,
      autoDetected: false,
    };
  });

  // Warn about unmapped important fields
  const mappedFields = new Set(result.filter(r => r.contactField !== "__skip__").map(r => r.contactField));
  const importantFields = ["financial_readiness", "urgency", "desired_salary", "blocker"] as const;
  const missingImportant = importantFields.filter(f => !mappedFields.has(f));
  if (missingImportant.length > 0) {
    console.warn(`[Form Response Import] WARNING: Important fields NOT found in CSV columns: ${missingImportant.join(", ")}`);
  }

  return result;
}

// ──────────────────────────────────────────
// Value normalization for enum fields
// ──────────────────────────────────────────

function normalizeWorkExperience(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower === "none" || lower.includes("fresher") || lower.includes("no experience")) return "fresher";
  if (lower.includes("<2") || lower.includes("less than 2") || lower.includes("0-2") || lower.includes("1-2")) return "<2_years";
  // "2 years" (exactly 2, no range) → <2_years bucket
  if (/^2\s*years?$/.test(lower)) return "<2_years";
  if (lower.includes("3-5") || lower.includes("3 to 5")) return "3-5_years";
  // "5+ years" or "5 + years" → 5-10_years bucket
  if (/^5\s*\+/.test(lower) || lower.includes("5+ years")) return "5-10_years";
  if (lower.includes("5-10") || lower.includes("5 to 10")) return "5-10_years";
  if (lower.includes("10+") || lower.includes("10 +") || lower.includes("more than 10")) return "10+_years";
  return raw; // store as-is if unrecognized
}

function normalizeFinancialReadiness(raw: string): string {
  // Normalize smart quotes before matching
  const lower = raw.toLowerCase().trim().replace(/[\u2018\u2019\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"');
  if (lower.startsWith("i'm ready") || lower.startsWith("i am ready") || lower.includes("ready to invest") || lower.includes("have the financial resources")) return "ready";
  if (lower.startsWith("i'm managing") || lower.startsWith("i am managing") || lower.includes("careful") || lower.includes("managing my finances") || lower.includes("can prioritize funding")) return "careful_but_open";
  if (lower.startsWith("my financial situation") || lower.includes("tight") || lower.includes("not in a position") || lower.includes("okay with staying where")) return "not_ready";
  return raw;
}

function normalizeUrgency(raw: string): string {
  const lower = raw.toLowerCase().trim().replace(/[\u2018\u2019\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"');
  if (lower.startsWith("right now") || lower.includes("let's get started") || lower.includes("lets get started") || lower.includes("immediately") || lower.includes("i'm all in")) return "right_now";
  if (lower.startsWith("within 90") || lower.includes("within 90 days") || lower.includes("next 3 months") || lower.includes("little time to prepare")) return "within_90_days";
  if (lower.startsWith("more than 90") || lower.includes("more than 90 days") || lower.includes("not sure") || lower.includes("not urgent") || lower.includes("on my list")) return "more_than_90_days";
  return raw;
}

export function normalizeFormResponseValues(
  row: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...row };

  if (typeof result.work_experience === "string" && result.work_experience) {
    result.work_experience = normalizeWorkExperience(result.work_experience);
  }
  if (typeof result.financial_readiness === "string" && result.financial_readiness) {
    result.financial_readiness = normalizeFinancialReadiness(result.financial_readiness);
  }
  if (typeof result.urgency === "string" && result.urgency) {
    result.urgency = normalizeUrgency(result.urgency);
  }
  // Parse booked_at — handles Excel serial dates (e.g. 45961.5431) and date strings
  if (typeof result.booked_at === "string" && result.booked_at) {
    result.booked_at = parseDateString(result.booked_at) ?? result.booked_at;
  }

  return result;
}

// ──────────────────────────────────────────
// Apply form response mappings
// ──────────────────────────────────────────

export function applyFormResponseMappings(
  rawRows: Record<string, string>[],
  mappings: ImportMapping[],
  config: FormResponseConfig
): Record<string, unknown>[] {
  const activeMappings = mappings.filter((m) => m.contactField !== "__skip__");

  return rawRows.map((row, idx) => {
    const mapped: Record<string, unknown> = {};

    for (const mapping of activeMappings) {
      const value = row[mapping.csvColumn];
      const trimmed = config.trim_whitespace ? value?.trim() : value;
      mapped[mapping.contactField] = trimmed || undefined;
    }

    const normalized = normalizeFormResponseValues(mapped);

    // Log first 3 rows for debugging
    if (idx < 3) {
      console.log(`[Form Response Import] Row ${idx} mapped:`, {
        email: mapped.email,
        desired_salary: mapped.desired_salary,
        financial_readiness: mapped.financial_readiness,
        urgency: mapped.urgency,
        blocker: mapped.blocker,
      });
      console.log(`[Form Response Import] Row ${idx} normalized:`, {
        financial_readiness: normalized.financial_readiness,
        urgency: normalized.urgency,
      });
    }

    return normalized;
  });
}

// ──────────────────────────────────────────
// Validate form response rows
// ──────────────────────────────────────────

export interface FormResponseValidationResult {
  valid: { index: number; data: ImportFormResponseRowValues }[];
  invalid: { index: number; errors: string[] }[];
}

export function validateFormResponseRows(
  rows: Record<string, unknown>[]
): FormResponseValidationResult {
  const valid: FormResponseValidationResult["valid"] = [];
  const invalid: FormResponseValidationResult["invalid"] = [];

  rows.forEach((row, index) => {
    const result = importFormResponseRowSchema.safeParse(row);
    if (result.success) {
      valid.push({ index, data: result.data });
    } else {
      const errors = result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      invalid.push({ index, errors });
    }
  });

  return { valid, invalid };
}
