import { render } from "@react-email/components";
import * as React from "react";
import { BaseLayout } from "./base-layout";

const BODY_SLOT = "%%BODY_SLOT%%";

// ── Props ───────────────────────────────────────────
interface DripWrapperProps {
  bodyHtml: string;
  preview?: string;
  unsubscribeUrl?: string;
}

// ── Component (uses text placeholder — no dangerouslySetInnerHTML) ──
function DripWrapperEmail({
  preview,
  unsubscribeUrl,
}: Omit<DripWrapperProps, "bodyHtml">) {
  return (
    <BaseLayout preview={preview} unsubscribeUrl={unsubscribeUrl}>
      <div>{BODY_SLOT}</div>
    </BaseLayout>
  );
}

// ── Render helper ───────────────────────────────────
export async function renderDripEmail(
  props: DripWrapperProps & { subject: string }
): Promise<{ subject: string; html: string }> {
  const wrapperHtml = await render(
    <DripWrapperEmail
      preview={props.subject}
      unsubscribeUrl={props.unsubscribeUrl}
    />
  );
  // Swap the text placeholder with the actual HTML body
  const html = wrapperHtml.replace(BODY_SLOT, props.bodyHtml);
  return {
    subject: props.subject,
    html,
  };
}

/**
 * Render just the wrapper chrome (for batch use in email-dispatcher).
 * Returns HTML with BODY_SLOT placeholder that callers can replace per-contact.
 */
export async function renderDripWrapper(
  opts?: { preview?: string; unsubscribeUrl?: string }
): Promise<{ wrapperHtml: string; placeholder: string }> {
  const wrapperHtml = await render(
    <DripWrapperEmail preview={opts?.preview} unsubscribeUrl={opts?.unsubscribeUrl} />
  );
  return { wrapperHtml, placeholder: BODY_SLOT };
}

export default DripWrapperEmail;
