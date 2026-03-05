import { Link, Section, Text } from "@react-email/components";
import { render } from "@react-email/components";
import * as React from "react";
import { BaseLayout, brand, styles } from "./base-layout";

// ── Props ───────────────────────────────────────────
interface WelcomeEmailProps {
  firstName: string;
  trainingUrl?: string;
  strategyUrl?: string;
}

const DEFAULT_TRAINING_URL = "https://ld.xperiencewave.com/";
const DEFAULT_STRATEGY_URL = "https://ld.xperiencewave.com/watch";

// ── Component ───────────────────────────────────────
export function WelcomeEmail({
  firstName = "there",
  trainingUrl = DEFAULT_TRAINING_URL,
  strategyUrl = DEFAULT_STRATEGY_URL,
}: WelcomeEmailProps) {
  return (
    <BaseLayout preview={`Your 35-minute training is ready, ${firstName}`}>
      <Text style={styles.paragraph}>
        Hi {firstName}, Shaik Murad here...
      </Text>

      <Text style={styles.paragraph}>
        Your 35-minute training is ready. It shows how to move beyond grunt
        execution into influence, recognition, and 2X pay in under 90 days —
        even if you don&apos;t have big titles, fancy degrees, or prior
        leadership experience
      </Text>

      <Text style={styles.paragraph}>
        This is for designers (UX, UI, Product, or Visual) with 2+ years who
        want to step into senior and leadership roles.
      </Text>

      <Section style={{ margin: "24px 0" }}>
        <Link
          href={trainingUrl}
          style={{
            fontSize: "15px",
            color: brand.primary,
            fontWeight: 600,
            textDecoration: "underline",
          }}
        >
          Watch the training →
        </Link>
      </Section>

      <Text style={styles.paragraph}>So you can command</Text>

      <Text style={{ ...styles.paragraph, paddingLeft: "16px" }}>
        • Bigger promotions and real outcomes, without degrees
        <br />
        • Build your authority from proof, not hours of work you do
        <br />
        • Do right-sized research, not heavy research
      </Text>

      <Text style={styles.paragraph}>Prefer 1:1 help?</Text>

      <Section style={{ margin: "0 0 24px" }}>
        <Link
          href={strategyUrl}
          style={{
            fontSize: "15px",
            color: brand.primary,
            fontWeight: 600,
            textDecoration: "underline",
          }}
        >
          Apply for your free career transformation strategy session →
        </Link>
      </Section>

      <Text style={styles.paragraph}>
        Or start watching now:
        <br />
        <Link
          href={trainingUrl}
          style={{ color: brand.primary, textDecoration: "underline" }}
        >
          {trainingUrl}
        </Link>
      </Text>

      <Text style={{ ...styles.signoff, borderTop: `1px solid ${brand.border}`, paddingTop: "24px" }}>
        Shaik Murad
        <br />
        Xperience Wave
      </Text>

      <Text style={{ ...styles.paragraph, marginTop: "24px", color: brand.secondary, fontStyle: "italic" }}>
        P.S. Want a personal 90-day plan after you watch? Reply
        &quot;Strategy&quot; and I&apos;ll send a short audit + booking link.
      </Text>
    </BaseLayout>
  );
}

// ── Render helper ───────────────────────────────────
export async function renderWelcomeEmail(
  props: WelcomeEmailProps
): Promise<{ subject: string; html: string }> {
  const html = await render(<WelcomeEmail {...props} />);
  return {
    subject: "[VIDEO Inside] Learn How to Move Beyond Grunt Design Execution",
    html,
  };
}

export default WelcomeEmail;
