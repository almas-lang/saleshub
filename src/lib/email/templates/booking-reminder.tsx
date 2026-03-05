import { Link, Section, Text } from "@react-email/components";
import { render } from "@react-email/components";
import * as React from "react";
import { BaseLayout, styles } from "./base-layout";

// ── Props ───────────────────────────────────────────
interface BookingReminderProps {
  firstName: string;
  date: string;
  time: string;
  hostName: string;
  meetLink: string;
}

// ── Component ───────────────────────────────────────
export function BookingReminderEmail({
  firstName = "there",
  date = "January 1, 2026",
  time = "10:00 AM",
  hostName = "Xperience Wave Team",
  meetLink = "#",
}: BookingReminderProps) {
  return (
    <BaseLayout
      preview={`Reminder: Your call is tomorrow at ${time}`}
    >
      <Text style={styles.paragraph}>Hi {firstName},</Text>

      <Text style={styles.paragraph}>
        Just a friendly reminder — your strategy call is tomorrow!
      </Text>

      {/* Meeting details card */}
      <Section style={styles.infoCard}>
        <Text style={styles.infoRow}>📅&nbsp; {date}</Text>
        <Text style={styles.infoRow}>🕐&nbsp; {time} (IST)</Text>
        <Text style={styles.infoRow}>👤&nbsp; with {hostName}</Text>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "32px 0" }}>
        <Link href={meetLink} style={styles.button}>
          Join Google Meet Call
        </Link>
      </Section>

      <Text style={styles.paragraph}>
        Can&apos;t make it? Reply to this email to reschedule.
      </Text>

      <Text style={styles.signoff}>The Xperience Wave Team</Text>
    </BaseLayout>
  );
}

// ── Render helper ───────────────────────────────────
export async function renderBookingReminderEmail(
  props: BookingReminderProps
): Promise<{ subject: string; html: string }> {
  const html = await render(<BookingReminderEmail {...props} />);
  return {
    subject: `Reminder: Your call is tomorrow at ${props.time}`,
    html,
  };
}

export default BookingReminderEmail;
