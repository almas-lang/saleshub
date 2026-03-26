import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

// ── Brand tokens ────────────────────────────────────
export const brand = {
  primary: "#FF0023",
  text: "#1A1D23",
  secondary: "#5C6370",
  muted: "#858B98",
  bgOuter: "#F4F4F5",
  bgCard: "#FFFFFF",
  border: "#E4E4E7",
} as const;

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// ── Props ───────────────────────────────────────────
interface BaseLayoutProps {
  preview?: string;
  children: React.ReactNode;
  unsubscribeUrl?: string;
}

// ── Component ───────────────────────────────────────
export function BaseLayout({
  preview,
  children,
  unsubscribeUrl = "#",
}: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      {preview && <Preview>{preview}</Preview>}
      <Body
        style={{
          backgroundColor: brand.bgOuter,
          fontFamily,
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            padding: "40px 20px",
          }}
        >
          {/* Header */}
          <Section style={{ textAlign: "center" as const, marginBottom: "32px" }}>
            <Text
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: brand.primary,
                margin: 0,
                letterSpacing: "-0.3px",
              }}
            >
              Xperience Wave
            </Text>
          </Section>

          {/* Card body */}
          <Section
            style={{
              backgroundColor: brand.bgCard,
              borderRadius: "12px",
              padding: "40px 32px",
              border: `1px solid ${brand.border}`,
            }}
          >
            {children}
          </Section>

          {/* Footer */}
          <Section style={{ textAlign: "center" as const, marginTop: "32px" }}>
            <Text
              style={{
                fontSize: "13px",
                color: brand.muted,
                margin: "0 0 8px",
                lineHeight: "20px",
              }}
            >
              Xperience Wave · Bangalore, India
            </Text>
            <Link
              href={unsubscribeUrl}
              style={{
                fontSize: "13px",
                color: brand.muted,
                textDecoration: "underline",
              }}
            >
              Unsubscribe
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ── Shared inline styles ────────────────────────────
export const styles = {
  heading: {
    fontSize: "20px",
    fontWeight: 600 as const,
    color: brand.text,
    margin: "0 0 16px",
    lineHeight: "28px",
  },
  paragraph: {
    fontSize: "15px",
    color: brand.text,
    lineHeight: "24px",
    margin: "0 0 16px",
  },
  button: {
    display: "inline-block" as const,
    backgroundColor: brand.primary,
    color: "#FFFFFF",
    fontSize: "15px",
    fontWeight: 600 as const,
    textDecoration: "none" as const,
    borderRadius: "8px",
    padding: "12px 28px",
    textAlign: "center" as const,
  },
  infoCard: {
    backgroundColor: "#F8F9FB",
    borderRadius: "8px",
    padding: "20px 24px",
    margin: "24px 0",
    border: `1px solid ${brand.border}`,
  },
  infoRow: {
    fontSize: "15px",
    color: brand.text,
    lineHeight: "28px",
    margin: 0,
  },
  signoff: {
    fontSize: "15px",
    color: brand.text,
    lineHeight: "24px",
    margin: "24px 0 0",
  },
  hr: {
    borderColor: brand.border,
    margin: "24px 0",
  },
} as const;
