import type { FormField, FormSection } from "@/types/bookings";

/** A section header (or null for the ungrouped bucket) paired with its fields. */
export interface FieldGroup {
  section: FormSection | null;
  fields: FormField[];
}

/**
 * Group form fields by their section into an ordered render list — the single
 * ordering authority shared by the builder and the public widget.
 *
 * Rules:
 * - Fields with no `sectionId`, or a `sectionId` that no longer exists, land in
 *   an ungrouped bucket rendered FIRST with no header (preserves the legacy
 *   flat-form look).
 * - Sections render in `order` (ties broken by their array position); fields
 *   keep their array order within each section.
 * - Every field lands in exactly one group — fields are never dropped.
 */
export function groupFieldsBySection(
  fields: FormField[],
  sections: FormSection[],
): FieldGroup[] {
  const known = new Set(sections.map((s) => s.id));
  const ungrouped: FormField[] = [];
  const bySection = new Map<string, FormField[]>();

  for (const field of fields) {
    const sid = field.sectionId;
    if (sid && known.has(sid)) {
      const list = bySection.get(sid) ?? [];
      list.push(field);
      bySection.set(sid, list);
    } else {
      ungrouped.push(field);
    }
  }

  const ordered = [...sections].sort((a, b) => a.order - b.order);
  const groups: FieldGroup[] = [];

  if (ungrouped.length > 0) {
    groups.push({ section: null, fields: ungrouped });
  }
  for (const section of ordered) {
    groups.push({ section, fields: bySection.get(section.id) ?? [] });
  }

  return groups;
}
