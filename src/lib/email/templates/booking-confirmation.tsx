import { Text } from "@react-email/components";
import { render } from "@react-email/components";
import * as React from "react";
import { BaseLayout, brand, styles } from "./base-layout";

// ── Props ───────────────────────────────────────────
interface BookingConfirmationProps {
  firstName: string;
}

// ── Component ───────────────────────────────────────
export function BookingConfirmationEmail({
  firstName = "there",
}: BookingConfirmationProps) {
  return (
    <BaseLayout preview="You're on the calendar. Details inside — see you soon.">
      <Text style={styles.paragraph}>Hi {firstName},</Text>

      <Text style={styles.paragraph}>
        Thanks for submitting your application and scheduling your call with
        Team Xperience Wave. We look forward to speaking with you soon!
      </Text>

      <Text style={styles.paragraph}>
        A separate email is shared with you that has the exact date and time for
        our call. Please make sure that you block this time in your calendar.
      </Text>

      <Text style={styles.paragraph}>
        In the meantime, all you need to do to prepare is get clear on where you
        want to go and what you want to achieve.
      </Text>

      <Text style={styles.paragraph}>
        On the call, we&apos;ll look at your current situation and where you
        want to take your career, then map out an action plan to get you there.
      </Text>

      <Text style={styles.paragraph}>
        Looking forward to speaking with you soon!
      </Text>

      <Text style={styles.signoff}>
        To Your Success!
        <br />
        Shaik Murad
      </Text>
    </BaseLayout>
  );
}

// ── Render helper ───────────────────────────────────
export async function renderBookingConfirmationEmail(
  props: BookingConfirmationProps
): Promise<{ subject: string; html: string }> {
  const html = await render(<BookingConfirmationEmail {...props} />);
  return {
    subject: `${props.firstName} — Your Application Was Successful (next steps)`,
    html,
  };
}

export default BookingConfirmationEmail;
