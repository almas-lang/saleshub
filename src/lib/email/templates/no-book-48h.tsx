import { Link, Section, Text } from "@react-email/components";
import { render } from "@react-email/components";
import * as React from "react";
import { BaseLayout, brand, styles } from "./base-layout";

// ── Props ───────────────────────────────────────────
interface NoBook48hProps {
  firstName: string;
  strategyUrl?: string;
}

const DEFAULT_STRATEGY_URL = "https://ld.xperiencewave.com/watch";

// ── Component ───────────────────────────────────────
export function NoBook48hEmail({
  firstName = "there",
  strategyUrl = DEFAULT_STRATEGY_URL,
}: NoBook48hProps) {
  return (
    <BaseLayout preview="We're closing applications in ~2 hours — grab your slot.">
      <Text style={styles.paragraph}>Hi, real quick...</Text>

      <Text style={styles.paragraph}>
        A few days ago, you watched a free training where I offered a personal
        1:1 strategy session on moving beyond grunt design execution into
        influence, recognition, and 2X pay in less than 90 days (without waiting
        for a designation)
      </Text>

      <Text style={styles.paragraph}>
        We&apos;re closing applications in ~2 hours due to high demand.
      </Text>

      <Text style={styles.paragraph}>
        If you&apos;re serious about building a top-notch design career, this is
        your chance to apply for a free strategy session
      </Text>

      <Text style={styles.paragraph}>
        In less than 2 hours, applications close. After that, this option is off
        the table.
        <br />
        No exceptions once it ends.
      </Text>

      <Section style={{ margin: "24px 0" }}>
        <Link
          href={strategyUrl}
          style={{
            fontSize: "15px",
            color: brand.primary,
            fontWeight: 600,
            textDecoration: "underline",
          }}
        >
          Apply for your free strategy session →
        </Link>
      </Section>

      <Text style={styles.paragraph}>
        This will be the last email about this. If you want the 45-minute
        consult, click the link and fill the form now.
      </Text>

      <Section style={{ margin: "0 0 24px" }}>
        <Link
          href={strategyUrl}
          style={{
            fontSize: "14px",
            color: brand.muted,
            textDecoration: "underline",
          }}
        >
          {strategyUrl}
        </Link>
      </Section>

      <Text style={styles.signoff}>
        Looking forward to speaking with you, {firstName}.
        <br />
        - Shaik Murad
      </Text>
    </BaseLayout>
  );
}

// ── Render helper ───────────────────────────────────
export async function renderNoBook48hEmail(
  props: NoBook48hProps
): Promise<{ subject: string; html: string }> {
  const html = await render(<NoBook48hEmail {...props} />);
  return {
    subject: "Last chance to book your call [ends tonight]",
    html,
  };
}

export default NoBook48hEmail;
