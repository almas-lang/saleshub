interface WeeklyAnalyticsProps {
  recipientName: string;
  period: string;
  newLeads: number;
  conversions: number;
  revenue: string;
  tasksCompleted: number;
  topSource: string;
}

/**
 * Weekly analytics email template — simple HTML string (not React Email).
 * Resend accepts plain HTML.
 */
export function weeklyAnalyticsHtml({
  recipientName,
  period,
  newLeads,
  conversions,
  revenue,
  tasksCompleted,
  topSource,
}: WeeklyAnalyticsProps): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Weekly Analytics - SalesHub</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="margin-bottom: 4px;">Weekly Analytics Summary</h2>
  <p style="color: #666; font-size: 14px; margin-top: 0;">${period}</p>

  <p>Hi ${recipientName},</p>
  <p>Here's your weekly overview from SalesHub:</p>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr>
      <td style="padding: 12px; border: 1px solid #e5e5e5; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #3B82F6;">${newLeads}</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">New Leads</div>
      </td>
      <td style="padding: 12px; border: 1px solid #e5e5e5; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #8B5CF6;">${conversions}</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">Conversions</div>
      </td>
      <td style="padding: 12px; border: 1px solid #e5e5e5; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #22c55e;">${revenue}</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">Revenue</div>
      </td>
      <td style="padding: 12px; border: 1px solid #e5e5e5; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #F59E0B;">${tasksCompleted}</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">Tasks Done</div>
      </td>
    </tr>
  </table>

  ${topSource ? `<p style="font-size: 14px;">Top lead source this week: <strong>${topSource}</strong></p>` : ""}

  <p style="margin-top: 20px;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.xperiencewave.com"}/analytics"
       style="display: inline-block; padding: 10px 20px; background: #3B82F6; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">
      View Full Analytics
    </a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    You're receiving this because you opted in to weekly analytics emails in SalesHub.
  </p>
</body>
</html>`;
}
