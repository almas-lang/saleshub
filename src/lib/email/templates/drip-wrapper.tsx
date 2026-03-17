import { Section } from "@react-email/components";
import { render } from "@react-email/components";
import * as React from "react";
import { BaseLayout } from "./base-layout";

// ── Props ───────────────────────────────────────────
interface DripWrapperProps {
  bodyHtml: string;
  preview?: string;
  unsubscribeUrl?: string;
}

// ── Component ───────────────────────────────────────
export function DripWrapperEmail({
  bodyHtml = "<p>Email content goes here.</p>",
  preview,
  unsubscribeUrl,
}: DripWrapperProps) {
  return (
    <BaseLayout preview={preview} unsubscribeUrl={unsubscribeUrl}>
      <Section dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </BaseLayout>
  );
}

// ── Render helper ───────────────────────────────────
export async function renderDripEmail(
  props: DripWrapperProps & { subject: string }
): Promise<{ subject: string; html: string }> {
  const html = await render(
    <DripWrapperEmail
      bodyHtml={props.bodyHtml}
      preview={props.subject}
      unsubscribeUrl={props.unsubscribeUrl}
    />
  );
  return {
    subject: props.subject,
    html,
  };
}

export default DripWrapperEmail;
