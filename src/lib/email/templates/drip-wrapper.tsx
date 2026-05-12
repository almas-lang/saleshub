import {
  Body,
  Head,
  Html,
  Link,
  Preview,
  render,
} from "@react-email/components";
import * as React from "react";

const BODY_SLOT = "%%BODY_SLOT%%";

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// ── Props ───────────────────────────────────────────
interface DripWrapperProps {
  bodyHtml: string;
  preview?: string;
  unsubscribeUrl?: string;
}

// ── Component — looks like a normal typed email, no branding ──
function DripWrapperEmail({
  preview,
  unsubscribeUrl = "#",
}: Omit<DripWrapperProps, "bodyHtml">) {
  return (
    <Html>
      <Head>
        <style>{`
          ul, ol { padding-left: 24px; margin: 8px 0; }
          li { margin: 0; padding: 0; }
          li + li { margin-top: 4px; }
          p { margin: 0 0 12px 0; line-height: 1.6; }
          a { color: #1a73e8; }
        `}</style>
      </Head>
      {preview && <Preview>{preview}</Preview>}
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily,
          fontSize: "14px",
          color: "#222222",
          margin: 0,
          padding: "12px 0",
        }}
      >
        <div
          style={{
            maxWidth: "100%",
            padding: "0 16px",
          }}
        >
          {/* Body content gets swapped in here */}
          <div>{BODY_SLOT}</div>

          {/* Tiny unsubscribe — just a link, no chrome */}
          <div
            style={{
              marginTop: "40px",
              fontSize: "11px",
              color: "#999999",
            }}
          >
            <Link
              href={unsubscribeUrl}
              style={{ color: "#999999", textDecoration: "underline" }}
            >
              Unsubscribe
            </Link>
          </div>
        </div>
      </Body>
    </Html>
  );
}

// ── Plain text render — no wrapper, just raw content + unsub ──
function renderPlainTextEmail(props: DripWrapperProps & { subject: string }): { subject: string; html: string } {
  const unsub = props.unsubscribeUrl
    ? `\n<br/><br/><div style="font-size:11px;color:#999999;margin-top:40px;"><a href="${props.unsubscribeUrl}" style="color:#999999;text-decoration:underline;">Unsubscribe</a></div>`
    : "";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:12px 16px;font-family:sans-serif;font-size:14px;color:#222222;">${props.bodyHtml}${unsub}</body></html>`;
  return { subject: props.subject, html };
}

// ── Render helper ───────────────────────────────────
export async function renderDripEmail(
  props: DripWrapperProps & { subject: string; plainText?: boolean }
): Promise<{ subject: string; html: string }> {
  if (props.plainText) {
    return renderPlainTextEmail(props);
  }
  const wrapperHtml = await render(
    <DripWrapperEmail
      preview={props.preview ?? props.subject}
      unsubscribeUrl={props.unsubscribeUrl}
    />
  );
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
  opts?: { preview?: string; unsubscribeUrl?: string; plainText?: boolean }
): Promise<{ wrapperHtml: string; placeholder: string }> {
  if (opts?.plainText) {
    const wrapperHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:12px 16px;font-family:sans-serif;font-size:14px;color:#222222;">${BODY_SLOT}\n<br/><br/><div style="font-size:11px;color:#999999;margin-top:40px;"><a href="#" style="color:#999999;text-decoration:underline;">Unsubscribe</a></div></body></html>`;
    return { wrapperHtml, placeholder: BODY_SLOT };
  }
  const wrapperHtml = await render(
    <DripWrapperEmail preview={opts?.preview} unsubscribeUrl={opts?.unsubscribeUrl} />
  );
  return { wrapperHtml, placeholder: BODY_SLOT };
}

export default DripWrapperEmail;
