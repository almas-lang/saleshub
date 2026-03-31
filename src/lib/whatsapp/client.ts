/**
 * WhatsApp Cloud API wrapper
 * Reference: ARCHITECTURE.md Section 7.2, PHASE2_SETUP.md Step 4
 *
 * Base URL: https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}
 * Auth: Bearer token from Meta System User
 */

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!;

const BASE_URL = `https://graph.facebook.com/v21.0`;
const MESSAGES_URL = `${BASE_URL}/${PHONE_NUMBER_ID}/messages`;

// ── Types ──────────────────────────────────────────

export interface WASendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WATemplate {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  parameter_format?: string;
  components: WATemplateComponent[];
}

export interface WATemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  buttons?: { type: string; text: string; url?: string; phone_number?: string }[];
}

export interface WATemplatesResult {
  success: boolean;
  templates?: WATemplate[];
  error?: string;
}

// ── Helpers ─────────────────────────────────────────

/** Strip to digits, ensure country code for WhatsApp API (no + prefix) */
function formatForWA(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  // Already has country code (91 + 10 digits)
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    return cleaned;
  }
  // 10-digit Indian number
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  return cleaned;
}

async function waFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg =
        data?.error?.message ??
        data?.error?.error_user_msg ??
        `HTTP ${res.status}`;
      console.error(`[WhatsApp API] ${options.method ?? "GET"} ${url}:`, errMsg);
      return { ok: false, error: errMsg };
    }

    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[WhatsApp API] fetch error:`, message);
    return { ok: false, error: message };
  }
}

// ── Public API ──────────────────────────────────────

/**
 * Send an approved template message.
 * Templates must be pre-approved in Meta Business Manager.
 *
 * @param to - Phone number (any format — will be normalized)
 * @param templateName - Approved template name (e.g., "xw_vsl_start")
 * @param params - Dynamic parameters for the template body
 * @param language - Template language code (default: "en")
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  params: string[] = [],
  language = "en",
  paramNames?: string[],
): Promise<WASendResult> {
  const phone = formatForWA(to);

  // Build body component parameters
  let components: Record<string, unknown>[] | undefined;
  if (params.length > 0) {
    const parameters = params.map((p, i) => {
      const param: Record<string, unknown> = { type: "text", text: p };
      // If named params provided, include parameter_name for NAMED format templates
      if (paramNames?.[i]) {
        param.parameter_name = paramNames[i];
      }
      return param;
    });
    components = [{ type: "body", parameters }];
  }

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      ...(components ? { components } : {}),
    },
  };

  const result = await waFetch<{
    messages: { id: string }[];
  }>(MESSAGES_URL, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    messageId: result.data?.messages?.[0]?.id,
  };
}

/**
 * Send a free-form text message.
 * Only works within the 24h conversation window (after user has messaged you).
 */
export async function sendTextMessage(
  to: string,
  text: string
): Promise<WASendResult> {
  const phone = formatForWA(to);

  const result = await waFetch<{
    messages: { id: string }[];
  }>(MESSAGES_URL, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text },
    }),
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    messageId: result.data?.messages?.[0]?.id,
  };
}

/**
 * Fetch all approved message templates from the WABA.
 */
export async function getTemplates(): Promise<WATemplatesResult> {
  const url = `${BASE_URL}/${WABA_ID}/message_templates?limit=100`;

  const result = await waFetch<{
    data: WATemplate[];
  }>(url);

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    templates: result.data?.data ?? [],
  };
}

/**
 * Create a new message template and submit it for Meta review.
 * Templates start in PENDING status until approved by Meta.
 */
export interface CreateTemplateButton {
  type: "URL" | "PHONE_NUMBER" | "QUICK_REPLY";
  text: string;
  url?: string;
  phone_number?: string;
}

export async function createTemplate(params: {
  name: string;
  category: "MARKETING" | "UTILITY";
  language: string;
  header?: { format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT"; text?: string };
  body: string;
  footer?: string;
  buttons?: CreateTemplateButton[];
  bodyExamples?: string[];
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const components: Record<string, unknown>[] = [];

  if (params.header) {
    const headerComponent: Record<string, unknown> = {
      type: "HEADER",
      format: params.header.format,
    };
    if (params.header.format === "TEXT" && params.header.text) {
      headerComponent.text = params.header.text;
    }
    // For IMAGE/VIDEO/DOCUMENT, Meta expects an example handle on creation,
    // but the actual media is provided at send time. We include the format only.
    components.push(headerComponent);
  }

  const bodyComponent: Record<string, unknown> = {
    type: "BODY",
    text: params.body,
  };
  if (params.bodyExamples?.length) {
    bodyComponent.example = {
      body_text: [params.bodyExamples],
    };
  }
  components.push(bodyComponent);

  if (params.footer) {
    components.push({
      type: "FOOTER",
      text: params.footer,
    });
  }

  if (params.buttons?.length) {
    components.push({
      type: "BUTTONS",
      buttons: params.buttons.map((b) => {
        if (b.type === "URL") {
          return { type: "URL", text: b.text, url: b.url };
        }
        if (b.type === "PHONE_NUMBER") {
          return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone_number };
        }
        return { type: "QUICK_REPLY", text: b.text };
      }),
    });
  }

  const url = `${BASE_URL}/${WABA_ID}/message_templates`;
  const result = await waFetch<{ id: string }>(url, {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      category: params.category,
      language: params.language,
      components,
    }),
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  return { success: true, id: result.data?.id };
}

/**
 * Delete a message template by name.
 * Only works for PENDING or REJECTED templates.
 */
export async function deleteTemplate(templateName: string): Promise<{ success: boolean; error?: string }> {
  const url = `${BASE_URL}/${WABA_ID}/message_templates?name=${encodeURIComponent(templateName)}`;
  const result = await waFetch(url, { method: "DELETE" });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  return { success: true };
}

/**
 * Mark an incoming message as read (blue ticks).
 */
export async function markAsRead(messageId: string): Promise<WASendResult> {
  const result = await waFetch(MESSAGES_URL, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  return { success: true };
}
