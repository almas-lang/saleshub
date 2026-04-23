const CONTRACT_DATE = "23 Mar 2026";

export const CONTRACT_ATTACHMENT_FILENAME = "Xperience-Wave-Enrollment-Contract.pdf";

export interface ContractEmailInput {
  name: string;
}

export interface ContractEmailOutput {
  subject: string;
  html: string;
}

export function renderContractEmail({ name }: ContractEmailInput): ContractEmailOutput {
  const firstName = (name || "").split(" ")[0] || name || "there";
  const subject = "Welcome to Xperience Wave — Your Enrollment Contract";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;padding:32px 36px;">
            <tr>
              <td style="font-size:15px;line-height:1.6;color:#1a1a1a;">
                <p style="margin:0 0 16px;">Hi ${escapeHtml(firstName)},</p>

                <p style="margin:0 0 16px;">Welcome to the <strong>Xperience Wave Mentorship Program</strong>. You've made a decision most designers keep postponing — and that already puts you ahead.</p>

                <p style="margin:0 0 16px;">This email has everything you need to hit the ground running. Please read through it carefully.</p>

                <p style="margin:24px 0 8px;font-size:11px;letter-spacing:0.6px;color:#888;text-transform:uppercase;font-weight:700;">Your Enrollment Contract</p>

                <p style="margin:0 0 16px;">Attached to this email is your Student Enrollment Contract (dated ${CONTRACT_DATE}). It covers the full terms of the mentorship program — including the 3-month active mentorship period, 1-year Wave Academy access, certification exam eligibility, no-refund policy, and everything in between.</p>

                <p style="margin:0 0 16px;">By acknowledging receipt of this email — either by replying to confirm or by continuing your participation in the program — you agree to the terms outlined in the contract.</p>

                <p style="margin:0 0 16px;">Please take a few minutes to read through it.</p>

                <p style="margin:24px 0 8px;font-size:11px;letter-spacing:0.6px;color:#888;text-transform:uppercase;font-weight:700;">A Few Things to Keep in Mind</p>

                <ul style="margin:0 0 16px;padding-left:20px;">
                  <li style="margin:0 0 8px;">Your mentorship (1:1 sessions + clinics) runs for <strong>3 months</strong> from your start date. Show up consistently — this window doesn't extend.</li>
                  <li style="margin:0 0 8px;">You have access to <strong>Wave Academy for 1 full year</strong>. Use it to its fullest.</li>
                  <li style="margin:0 0 8px;">If you need to reschedule a session, email us at least one day in advance and inform your mentor. No advance notice = session marked as completed.</li>
                  <li style="margin:0 0 8px;">After completing the mentorship, you can take the certification exam for free within 6 months.</li>
                </ul>

                <hr style="margin:24px 0;border:none;border-top:1px solid #eee;" />

                <p style="margin:0 0 16px;">This is your time to level up. We've built this program around what actually works for you — not theory, not fluff. But it only works if you do.</p>

                <p style="margin:0 0 24px;">Looking forward to working with you.</p>

                <p style="margin:0;font-weight:600;">Shaik Murad</p>
                <p style="margin:2px 0 0;color:#666;font-size:13px;">Co-Founder &amp; Head of Design</p>
                <p style="margin:2px 0 0;color:#666;font-size:13px;">Xperience Wave</p>
                <p style="margin:6px 0 0;color:#666;font-size:13px;">
                  <a href="mailto:hello@xperiencewave.com" style="color:#0066ff;text-decoration:none;">hello@xperiencewave.com</a> &nbsp;|&nbsp; 080 4132 5804
                </p>
                <p style="margin:2px 0 0;color:#666;font-size:13px;">
                  <a href="https://xperiencewave.com" style="color:#0066ff;text-decoration:none;">xperiencewave.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
