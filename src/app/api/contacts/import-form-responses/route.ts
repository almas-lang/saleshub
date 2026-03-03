import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importFormResponseBatchSchema } from "@/lib/validations";
import type { FormResponseBatchResult } from "@/types/import";

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json();
  const parsed = importFormResponseBatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { rows, config } = parsed.data;
  const result: FormResponseBatchResult = { matched: 0, created: 0, skipped: 0, errors: [] };

  // ── Batch lookup: email, phone, name ────────────────
  const emails = rows
    .map((r) => r.email.toLowerCase().trim())
    .filter(Boolean);
  const phones = rows
    .map((r) => r.phone?.trim())
    .filter((p): p is string => !!p);

  const uniqueEmails = [...new Set(emails)];
  const uniquePhones = [...new Set(phones)];

  type ContactRecord = { id: string; [key: string]: unknown };
  const contactsByEmail: Record<string, ContactRecord> = {};
  const contactsByPhone: Record<string, ContactRecord> = {};
  const contactsByName: Record<string, ContactRecord> = {};

  // Fetch all non-deleted prospects for matching
  const allLookups = await Promise.all([
    uniqueEmails.length > 0
      ? supabase.from("contacts").select("*").in("email", uniqueEmails).is("deleted_at", null)
      : null,
    uniquePhones.length > 0
      ? supabase.from("contacts").select("*").in("phone", uniquePhones).is("deleted_at", null)
      : null,
  ]);

  // Build email lookup
  if (allLookups[0]?.data) {
    for (const contact of allLookups[0].data) {
      if (contact.email) {
        contactsByEmail[contact.email.toLowerCase()] = contact;
      }
    }
  }

  // Build phone lookup (normalize: strip spaces, dashes)
  if (allLookups[1]?.data) {
    for (const contact of allLookups[1].data) {
      if (contact.phone) {
        contactsByPhone[contact.phone.replace(/[\s\-]/g, "")] = contact;
      }
    }
  }

  // Build name lookup — fetch all prospects for name-based fallback
  // Only load if there are rows that might need name matching
  const { data: allContacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("type", "prospect")
    .is("deleted_at", null);

  if (allContacts) {
    for (const contact of allContacts) {
      const nameKey = `${(contact.first_name || "").toLowerCase().trim()} ${(contact.last_name || "").toLowerCase().trim()}`.trim();
      if (nameKey) {
        contactsByName[nameKey] = contact;
      }
    }
  }

  // ── Fetch existing form responses for skip logic ──
  let existingResponseContactIds = new Set<string>();

  if (config.duplicate_handling === "skip") {
    const allMatchedIds = new Set([
      ...Object.values(contactsByEmail).map((c) => c.id),
      ...Object.values(contactsByPhone).map((c) => c.id),
      ...Object.values(contactsByName).map((c) => c.id),
    ]);
    if (allMatchedIds.size > 0) {
      const { data: existingResponses } = await supabase
        .from("contact_form_responses")
        .select("contact_id")
        .in("contact_id", [...allMatchedIds]);

      if (existingResponses) {
        existingResponseContactIds = new Set(
          existingResponses.map((r) => r.contact_id)
        );
      }
    }
  }

  // ── Process each row ──────────────────────────────
  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];
      const email = row.email.toLowerCase().trim();
      const phone = row.phone?.trim().replace(/[\s\-]/g, "") || "";
      const nameKey = `${(row.first_name || "").toLowerCase().trim()} ${(row.last_name || "").toLowerCase().trim()}`.trim();

      // 1. Match contact: email → phone → name
      const contact =
        contactsByEmail[email] ||
        (phone ? contactsByPhone[phone] : null) ||
        (nameKey ? contactsByName[nameKey] : null) ||
        null;

      if (!contact) {
        result.errors.push({
          row: i,
          error: `No contact found for email: ${email}${phone ? `, phone: ${phone}` : ""}${nameKey ? `, name: ${nameKey}` : ""}`,
        });
        continue;
      }

      result.matched++;

      // 2. Check for existing form response (skip mode)
      if (
        config.duplicate_handling === "skip" &&
        existingResponseContactIds.has(contact.id)
      ) {
        result.skipped++;
        continue;
      }

      // 3. Create form response record
      const formResponse: Record<string, unknown> = {
        contact_id: contact.id,
        form_email: email, // store the Calendly form email (may differ from contact email)
      };

      // Valid DB enum values
      const VALID_WORK_EXPERIENCE = ["fresher", "<2_years", "3-5_years", "5-10_years", "10+_years"];
      const VALID_FINANCIAL_READINESS = ["ready", "careful_but_open", "not_ready"];
      const VALID_URGENCY = ["right_now", "within_90_days", "more_than_90_days"];

      // Map form response fields (only insert enum values if they match valid DB values)
      if (row.work_experience) {
        if (VALID_WORK_EXPERIENCE.includes(row.work_experience)) {
          formResponse.work_experience = row.work_experience;
        }
        // else: skip — unrecognized value, don't send to enum column
      }

      // Merge employment_status into current_role (old form had separate columns)
      // e.g. "Full-time employee" + "Associate Designer" → "Full-time employee — Associate Designer"
      // Skip values that look like URLs (mismatched column mapping)
      const isUrl = (v: string) => /^https?:\/\//i.test(v) || /linkedin\.com/i.test(v);
      const employmentStatus = row.employment_status?.trim();
      const currentRole = row.current_role?.trim();
      const cleanEmployment = employmentStatus && !isUrl(employmentStatus) ? employmentStatus : null;
      const cleanRole = currentRole && !isUrl(currentRole) ? currentRole : null;
      if (cleanEmployment && cleanRole) {
        formResponse.current_role = `${cleanEmployment} — ${cleanRole}`;
      } else if (cleanRole) {
        formResponse.current_role = cleanRole;
      } else if (cleanEmployment) {
        formResponse.current_role = cleanEmployment;
      }

      if (row.key_challenge) formResponse.key_challenge = row.key_challenge;
      if (row.desired_salary) formResponse.desired_salary = row.desired_salary;
      if (row.blocker) formResponse.blocker = row.blocker;
      if (row.financial_readiness) {
        if (VALID_FINANCIAL_READINESS.includes(row.financial_readiness)) {
          formResponse.financial_readiness = row.financial_readiness;
        }
      }
      if (row.urgency) {
        if (VALID_URGENCY.includes(row.urgency)) {
          formResponse.urgency = row.urgency;
        }
      }

      // Use booked_at as created_at if available (preserves original booking time)
      if (row.booked_at) {
        formResponse.created_at = row.booked_at;
      }

      const { error: frError } = await supabase
        .from("contact_form_responses")
        .insert(formResponse);

      if (frError) {
        result.errors.push({ row: i, error: frError.message });
        continue;
      }

      // 4. Update contact fields if provided (non-destructive merge)
      const contactUpdates: Record<string, unknown> = {};
      if (row.linkedin_url && !contact.linkedin_url) {
        contactUpdates.linkedin_url = row.linkedin_url;
      }
      if (row.phone && !contact.phone) {
        contactUpdates.phone = row.phone;
      }

      // Move contact to target funnel/stage
      contactUpdates.funnel_id = config.target_funnel_id;
      contactUpdates.current_stage_id = config.target_stage_id;

      if (Object.keys(contactUpdates).length > 0) {
        await supabase
          .from("contacts")
          .update(contactUpdates)
          .eq("id", contact.id);
      }

      // 5. Log activity (use booked_at as timestamp if available)
      const activity: Record<string, unknown> = {
        contact_id: contact.id,
        type: "booking_created",
        title: "Call booked — form response imported",
      };
      if (row.booked_at) {
        activity.created_at = row.booked_at;
      }
      await supabase.from("activities").insert(activity);

      result.created++;
    } catch (err) {
      result.errors.push({
        row: i,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json(result);
}
