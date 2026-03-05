import { Link, Section, Text } from "@react-email/components";
import { render } from "@react-email/components";
import * as React from "react";
import { BaseLayout, brand, styles } from "./base-layout";

// ── Props ───────────────────────────────────────────
interface NoBook24hProps {
  firstName: string;
  strategyUrl?: string;
}

const DEFAULT_STRATEGY_URL = "https://ld.xperiencewave.com/watch";

// ── Component ───────────────────────────────────────
export function NoBook24hEmail({
  firstName = "there",
  strategyUrl = DEFAULT_STRATEGY_URL,
}: NoBook24hProps) {
  return (
    <BaseLayout preview="Grab a slot for your free Strategy Session.">
      <Text style={styles.paragraph}>
        Hi {firstName}! Shaik Murad here...
      </Text>

      <Text style={styles.paragraph}>
        Not too long ago, you showed interest in becoming a senior designer and
        leader with more pay, influence, and scope - but you haven&apos;t booked
        your free strategy session yet.
      </Text>

      <Text style={styles.paragraph}>
        Totally fine if you got busy… but I wanted to grab your attention towards
        your career again. If leveling up is a priority this year, I&apos;m
        inviting you again to book a personal consult with me.
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
          Click Here To Apply For Your Career Strategy Session →
        </Link>
      </Section>

      <Text style={styles.paragraph}>
        This is where we will personally get on the phone with you to determine:
      </Text>

      <Text style={{ ...styles.paragraph, paddingLeft: "16px" }}>
        • Your current capability and POA (Plan of Action)
        <br />
        • Which Core design skills can you put to use today, your readiness for
        design leadership, AI enablement, and growth partnership
        <br />
        • Your custom action plan that&apos;ll give you a proven approach to
        build your eccentric personal brand with whom everyone would love to pay
        more and work with
      </Text>

      <Text style={styles.paragraph}>
        And ultimately, whether or not our program is the right fit for you, to
        make this the best year of your life career-wise.
      </Text>

      <Text style={styles.paragraph}>
        If you&apos;re ready to step up and move forward fast, lock your slot
        now:
      </Text>

      <Text style={styles.paragraph}>Book your strategy session →</Text>

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
        To your success,
        <br />
        Shaik Murad
      </Text>
    </BaseLayout>
  );
}

// ── Render helper ───────────────────────────────────
export async function renderNoBook24hEmail(
  props: NoBook24hProps
): Promise<{ subject: string; html: string }> {
  const html = await render(<NoBook24hEmail {...props} />);
  return {
    subject: "You Still Haven't Completed Your Application?",
    html,
  };
}

export default NoBook24hEmail;
