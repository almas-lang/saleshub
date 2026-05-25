/**
 * Server-side campaign validation, run only when ACTIVATING a campaign.
 *
 * The wizards validate the flow client-side, but that is bypassable and the server
 * previously enforced nothing — a structurally broken journey could be activated and
 * then misbehave at runtime. This is the authoritative gate.
 *
 * Deliberately conservative: it runs only on activation (never blocks a draft / WIP
 * save) and rejects only unambiguously broken structures. WhatsApp template checks
 * degrade gracefully — if Meta can't be reached, or a template isn't in the fetched
 * page, we warn instead of blocking.
 */

import { getTemplates, type WATemplate } from "@/lib/whatsapp/client";

export interface ValidationStep {
  node_id?: string | null;
  order?: number | null;
  step_type?: string | null;
  channel?: string | null; // unified only; absent for email/wa-only steps
  condition?: { check?: string | null } | null;
  wa_template_name?: string | null;
  wa_template_language?: string | null;
  wa_template_params?: string[] | null;
  next_step_id_yes?: string | null;
  next_step_id_no?: string | null;
}

export interface ValidationEdge {
  source_node_id: string;
  target_node_id: string;
  branch?: "yes" | "no" | null;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function isSend(s: ValidationStep): boolean {
  return (s.step_type ?? "send") === "send";
}
function isCondition(s: ValidationStep): boolean {
  return s.step_type === "condition";
}

/** Count distinct {{variable}} placeholders in a template's BODY component. */
function countTemplateVariables(t: WATemplate): number {
  const body = t.components?.find((c) => c.type === "BODY");
  if (!body?.text) return 0;
  const matches = body.text.match(/\{\{\s*\w+\s*\}\}/g) ?? [];
  return new Set(matches.map((m) => m.replace(/[{}\s]/g, ""))).size;
}

/** Validate WhatsApp send steps against live Meta templates. Never blocks on infra. */
async function validateWaTemplates(steps: ValidationStep[]): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const waSteps = steps.filter(
    (s) =>
      isSend(s) &&
      (s.channel == null || s.channel === "whatsapp") &&
      !!s.wa_template_name,
  );
  if (waSteps.length === 0) return { errors, warnings };

  let res;
  try {
    res = await getTemplates();
  } catch {
    warnings.push("Could not reach Meta to verify WhatsApp templates — skipping template check.");
    return { errors, warnings };
  }
  if (!res.success || !res.templates) {
    warnings.push("Could not verify WhatsApp templates with Meta — skipping template check.");
    return { errors, warnings };
  }

  const byKey = new Map<string, WATemplate>();
  for (const t of res.templates) byKey.set(`${t.name}::${t.language}`, t);

  for (const s of waSteps) {
    const lang = s.wa_template_language || "en";
    const t = byKey.get(`${s.wa_template_name}::${lang}`);
    const paramCount = (s.wa_template_params ?? []).length;
    if (!t) {
      // Might be pagination (we only fetch a page) — warn, don't block.
      warnings.push(
        `WhatsApp template "${s.wa_template_name}" (${lang}) was not found in your approved templates. Sends may fail.`,
      );
      continue;
    }
    const expected = countTemplateVariables(t);
    if (expected !== paramCount) {
      errors.push(
        `WhatsApp template "${s.wa_template_name}" expects ${expected} variable(s) but ${paramCount} are configured. Fix the step before activating.`,
      );
    }
  }
  return { errors, warnings };
}

/**
 * Validate a campaign about to be activated.
 *
 * Pass `edges` when validating an unsaved payload (POST, or PATCH that replaces
 * steps). Omit `edges` to validate already-stored steps (PATCH that only flips
 * status) — in that case a condition's connectivity is read from its
 * `next_step_id_yes` / `next_step_id_no` pointers.
 */
export async function validateCampaignForActivation(args: {
  steps: ValidationStep[];
  edges?: ValidationEdge[] | null;
}): Promise<ValidationResult> {
  const { steps } = args;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (steps.length === 0) {
    errors.push("Campaign has no steps.");
    return { errors, warnings };
  }

  if (!steps.some(isSend)) {
    errors.push("Add at least one send step before activating.");
  }

  const hasEdges = !!args.edges?.length;
  const outgoing = new Map<string, ValidationEdge[]>();
  if (hasEdges) {
    for (const e of args.edges!) {
      if (!outgoing.has(e.source_node_id)) outgoing.set(e.source_node_id, []);
      outgoing.get(e.source_node_id)!.push(e);
    }
  }
  const nodeIds = new Set(steps.map((s) => s.node_id).filter(Boolean) as string[]);

  function conditionHasOutgoing(s: ValidationStep): boolean {
    if (hasEdges && s.node_id) return (outgoing.get(s.node_id)?.length ?? 0) > 0;
    return !!(s.next_step_id_yes || s.next_step_id_no);
  }

  for (const s of steps) {
    if (!isCondition(s)) continue;
    if (!s.condition?.check) {
      errors.push("A condition step has no check selected (e.g. 'Has booking').");
    }
    if (!conditionHasOutgoing(s)) {
      errors.push("A condition step has no outgoing branch connected — it would dead-end the journey.");
    }
  }

  // Edges (when present) must reference real steps.
  if (hasEdges && nodeIds.size > 0) {
    for (const e of args.edges!) {
      if (!nodeIds.has(e.source_node_id) || !nodeIds.has(e.target_node_id)) {
        errors.push("A connection points to a step that no longer exists — re-draw the flow and save again.");
        break;
      }
    }
  }

  const wa = await validateWaTemplates(steps);
  errors.push(...wa.errors);
  warnings.push(...wa.warnings);

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
