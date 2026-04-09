/**
 * Resend Email API wrapper
 * Reference: ARCHITECTURE.md Section 7.3, PHASE2_SETUP.md Step 4
 *
 * Sends transactional and campaign emails via Resend.
 * Domain: team@xperiencewave.com (DNS verified)
 */

import { Resend } from "resend";
import { logger } from "@/lib/logger";

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
      await logger.error("email", `Send failed: ${error.message}`, {
        to: options.to,
        subject: options.subject,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    await logger.info("email", `Sent to ${Array.isArray(options.to) ? options.to.join(", ") : options.to}`, {
      to: options.to,
      subject: options.subject,
      messageId: data?.id,
    });
    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await logger.error("email", `Send exception: ${message}`, { to: options.to });
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
      await logger.error("email", `Batch send failed: ${error.message}`, { count: emails.length, error: error.message });
      return { success: false, error: error.message };
    }

    const messageIds = data?.data?.map((d) => d.id) ?? [];
    await logger.info("email", `Batch sent ${emails.length} emails`, { count: emails.length });
    return { success: true, messageIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await logger.error("email", `Batch exception: ${message}`, { count: emails.length });
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

/**
 * Generate an unsubscribe URL for a contact.
 */
export function getUnsubscribeUrl(contactId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.xperiencewave.com";
  const token = Buffer.from(contactId).toString("base64url");
  return `${appUrl}/unsubscribe?token=${token}`;
}
