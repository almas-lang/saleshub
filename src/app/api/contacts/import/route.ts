import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importBatchSchema } from "@/lib/validations";
import { formatPhone } from "@/lib/utils";
import type { ImportBatchResult } from "@/types/import";

/** Convert an Excel serial date number to an ISO 8601 string. */
function excelSerialToISO(serial: number): string | null {
  // Excel epoch = Jan 1 1900, with the known leap-year bug.
  // 25569 = days between 1900-01-01 and 1970-01-01 (Unix epoch).
  const MS_PER_DAY = 86_400_000;
  const date = new Date((serial - 25569) * MS_PER_DAY);
  if (isNaN(date.getTime()) || date.getFullYear() < 1970 || date.getFullYear() > 2100) {
    return null;
  }
  return date.toISOString();
}

/**
 * Parse messy date strings into ISO format.
 * Handles: ISO, DD/MM/YYYY, DD/MM/YYYY HH:mm:ss, and Excel serial numbers.
 * Treats ambiguous DD/MM vs MM/DD as day-first.
 */
function parseDate(value: unknown): string | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const str = value.trim();

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

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY or DD:MM:YYYY (no time)
  const dateOnly = str.match(/^(\d{1,2})[/\-:.](\d{1,2})[/\-:.](\d{4})$/);
  if (dateOnly) {
    const [, d, m, y] = dateOnly;
    const day = Number(d), month = Number(m), year = Number(y);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`;
      const date = new Date(iso);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
  }

  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json();
  const parsed = importBatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { rows, config } = parsed.data;
  const result: ImportBatchResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  // ── Batch dedup lookup ────────────────────────────
  const emails = rows
    .map((r) => r.email)
    .filter((e): e is string => !!e && e !== "");
  const phones = rows
    .map((r) => r.phone)
    .filter((p): p is string => !!p && p !== "");

  // Normalize phones for lookup
  const normalizedPhones = phones.map((p) => formatPhone(p));

  const existingByEmail: Record<string, Record<string, unknown>> = {};
  const existingByPhone: Record<string, Record<string, unknown>> = {};

  if (config.duplicate_handling !== "create_always") {
    if (emails.length > 0) {
      const { data: emailMatches } = await supabase
        .from("contacts")
        .select("*")
        .in("email", emails)
        .is("deleted_at", null);

      if (emailMatches) {
        for (const contact of emailMatches) {
          if (contact.email) {
            existingByEmail[contact.email.toLowerCase()] = contact;
          }
        }
      }
    }

    if (normalizedPhones.length > 0) {
      const { data: phoneMatches } = await supabase
        .from("contacts")
        .select("*")
        .in("phone", normalizedPhones)
        .is("deleted_at", null);

      if (phoneMatches) {
        for (const contact of phoneMatches) {
          if (contact.phone) {
            existingByPhone[contact.phone] = contact;
          }
        }
      }
    }
  }

  // ── Process each row ──────────────────────────────
  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];

      // Clean: trim whitespace, empty strings → null for FK fields
      const cleaned: Record<string, unknown> = { ...row, type: "prospect" };

      if (config.trim_whitespace) {
        for (const [key, value] of Object.entries(cleaned)) {
          if (typeof value === "string") {
            cleaned[key] = value.trim();
          }
        }
      }

      // Normalize phone
      if (config.normalize_phones && cleaned.phone && typeof cleaned.phone === "string") {
        cleaned.phone = formatPhone(cleaned.phone);
      }

      // Parse date fields — normalize to ISO or remove so DB defaults apply
      const parsedCreatedAt = parseDate(cleaned.created_at);
      if (parsedCreatedAt) {
        cleaned.created_at = parsedCreatedAt;
      } else {
        delete cleaned.created_at; // let DB default to NOW()
      }

      const parsedConvertedAt = parseDate(cleaned.converted_at);
      if (parsedConvertedAt) {
        cleaned.converted_at = parsedConvertedAt;
      } else {
        cleaned.converted_at = null;
      }

      // Handle metadata — empty object → null
      if (cleaned.metadata && typeof cleaned.metadata === "object") {
        if (Object.keys(cleaned.metadata as Record<string, unknown>).length === 0) {
          cleaned.metadata = null;
        }
      }

      // Empty strings → null for FK fields
      for (const key of ["email", "funnel_id", "current_stage_id", "assigned_to", "linkedin_url"]) {
        if (cleaned[key] === "" || cleaned[key] === undefined) {
          cleaned[key] = null;
        }
      }

      // Convert empty optional strings to null
      for (const key of ["last_name", "company_name", "source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "converted_at"]) {
        if (cleaned[key] === "" || cleaned[key] === undefined) {
          cleaned[key] = null;
        }
      }

      // Ensure tags is an array or null
      if (!cleaned.tags || (Array.isArray(cleaned.tags) && cleaned.tags.length === 0)) {
        cleaned.tags = null;
      }

      // ── Dedup check ──────────────────────────────
      if (config.duplicate_handling !== "create_always") {
        const email = typeof cleaned.email === "string" ? cleaned.email.toLowerCase() : null;
        const phone = typeof cleaned.phone === "string" ? cleaned.phone : null;

        const existingContact =
          (email && existingByEmail[email]) ||
          (phone && existingByPhone[phone]) ||
          null;

        if (existingContact) {
          if (config.duplicate_handling === "skip") {
            result.skipped++;
            continue;
          }

          if (config.duplicate_handling === "update") {
            // Merge non-null fields into existing contact
            const updates: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(cleaned)) {
              if (key === "type" || key === "id") continue;
              if (value !== null && value !== undefined) {
                updates[key] = value;
              }
            }

            const { error } = await supabase
              .from("contacts")
              .update(updates)
              .eq("id", (existingContact as Record<string, unknown>).id as string);

            if (error) {
              result.errors.push({ row: i, error: error.message });
            } else {
              result.updated++;
            }
            continue;
          }
        }
      }

      // ── Insert new contact ────────────────────────
      const { error } = await supabase.from("contacts").insert(cleaned);

      if (error) {
        // Handle unique constraint violation as skip
        if (error.code === "23505") {
          result.skipped++;
        } else {
          result.errors.push({ row: i, error: error.message });
        }
      } else {
        result.created++;
      }
    } catch (err) {
      result.errors.push({
        row: i,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json(result);
}
