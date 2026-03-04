/**
 * Resend Email API wrapper
 * Reference: ARCHITECTURE.md Section 7.3, PHASE2_SETUP.md Step 4
 *
 * Sends transactional and campaign emails via Resend.
 * Domain: team@xperiencewave.com (DNS verified)
 */

import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const DEFAULT_FROM = "Xperience Wave <team@xperiencewave.com>";

// ── Types ──────────────────────────────────────────

export interface EmailSendOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BatchEmailItem {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface BatchEmailResult {
  success: boolean;
  messageIds?: string[];
  error?: string;
}

// ── Public API ──────────────────────────────────────

/**
 * Send a single email via Resend.
 *
 * @param options - Email options (to, subject, html, optional from/replyTo)
 */
export async function sendEmail(
  options: EmailSendOptions
): Promise<EmailSendResult> {
  try {
    const { data, error } = await getResend().emails.send({
      from: options.from ?? DEFAULT_FROM,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
      tags: options.tags,
    });

    if (error) {
      console.error("[Resend] send error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Resend] send error:", message);
    return { success: false, error: message };
  }
}

/**
 * Send up to 100 emails in a single API call (Resend batch endpoint).
 *
 * @param emails - Array of email items to send
 */
export async function sendBatchEmails(
  emails: BatchEmailItem[]
): Promise<BatchEmailResult> {
  if (emails.length === 0) {
    return { success: true, messageIds: [] };
  }

  if (emails.length > 100) {
    return {
      success: false,
      error: "Batch limit is 100 emails per call",
    };
  }

  try {
    const { data, error } = await getResend().batch.send(
      emails.map((e) => ({
        from: e.from ?? DEFAULT_FROM,
        to: Array.isArray(e.to) ? e.to : [e.to],
        subject: e.subject,
        html: e.html,
        replyTo: e.replyTo,
        tags: e.tags,
      }))
    );

    if (error) {
      console.error("[Resend] batch error:", error.message);
      return { success: false, error: error.message };
    }

    const messageIds = data?.data?.map((d) => d.id) ?? [];
    return { success: true, messageIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Resend] batch error:", message);
    return { success: false, error: message };
  }
}

/**
 * Render template variables in a string.
 * Replaces {{first_name}}, {{last_name}}, etc. with actual values.
 */
export function renderVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}
