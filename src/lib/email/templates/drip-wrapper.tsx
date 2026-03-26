import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Text,
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

// ── Component — clean, plain-text-style layout (no card/header chrome) ──
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
          p { margin: 0 0 12px 0; }
        `}</style>
      </Head>
      {preview && <Preview>{preview}</Preview>}
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily,
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            margin: "0",
            padding: "16px 20px",
          }}
        >
          {/* Body content gets swapped in here */}
          <div>{BODY_SLOT}</div>

          {/* Minimal footer */}
          <Text
            style={{
              fontSize: "12px",
              color: "#999999",
              lineHeight: "18px",
              marginTop: "40px",
              borderTop: "1px solid #eeeeee",
              paddingTop: "16px",
            }}
          >
            <Link
              href={unsubscribeUrl}
              style={{ color: "#999999", textDecoration: "underline" }}
            >
              Unsubscribe
            </Link>
            {" | "}
            Xperience Wave · Bangalore, India
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ── Render helper ───────────────────────────────────
export async function renderDripEmail(
  props: DripWrapperProps & { subject: string }
): Promise<{ subject: string; html: string }> {
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
  opts?: { preview?: string; unsubscribeUrl?: string }
): Promise<{ wrapperHtml: string; placeholder: string }> {
  const wrapperHtml = await render(
    <DripWrapperEmail preview={opts?.preview} unsubscribeUrl={opts?.unsubscribeUrl} />
  );
  return { wrapperHtml, placeholder: BODY_SLOT };
}

export default DripWrapperEmail;
