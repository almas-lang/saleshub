import { Link, Section, Text } from "@react-email/components";
import { render } from "@react-email/components";
import * as React from "react";
import { BaseLayout, brand, styles } from "./base-layout";

// ── Props ───────────────────────────────────────────
interface NoBookNudgeProps {
  firstName: string;
  strategyUrl?: string;
}

const DEFAULT_STRATEGY_URL = "https://ld.xperiencewave.com/watch";

// ── Component ───────────────────────────────────────
export function NoBookNudgeEmail({
  firstName = "there",
  strategyUrl = DEFAULT_STRATEGY_URL,
}: NoBookNudgeProps) {
  return (
    <BaseLayout preview="You didn't finish your application — here's your link.">
      <Text style={styles.paragraph}>Hi {firstName},</Text>

      <Text style={styles.paragraph}>
        Not long ago, you showed interest in moving into a senior design and
        leadership position with more pay, influence, and scope - but you
        didn&apos;t book your free Strategy Session.
      </Text>

      <Text style={styles.paragraph}>
        Totally fine if you got busy. If levelling up is a priority this year,
        book a free personal consult with me:
      </Text>

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
          Apply for your free strategy session →
        </Link>
      </Section>

      <Text style={styles.paragraph}>What we&apos;ll cover</Text>

      <Text style={{ ...styles.paragraph, paddingLeft: "16px" }}>
        • Your current capability and POA (plan of action)
        <br />
        • Where you can apply Core design today, your readiness for Design
        Leadership + Growth ownership, and your path toward Deep Generalist
        <br />
        • A custom 90-day action plan you can start immediately
        <br />
        • And ultimately, whether our program is the right fit for you right now
      </Text>

      <Text style={styles.paragraph}>
        If you&apos;re ready to step up and move faster, lock your slot here:
      </Text>

      <Section style={{ margin: "0 0 4px" }}>
        <Link
          href={strategyUrl}
          style={{
            fontSize: "15px",
            color: brand.primary,
            fontWeight: 600,
            textDecoration: "underline",
          }}
        >
          Book your Strategy Session →
        </Link>
      </Section>

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
export async function renderNoBookNudgeEmail(
  props: NoBookNudgeProps
): Promise<{ subject: string; html: string }> {
  const html = await render(<NoBookNudgeEmail {...props} />);
  return {
    subject: "Fwd: You Didn't Finish Your Application?",
    html,
  };
}

export default NoBookNudgeEmail;
