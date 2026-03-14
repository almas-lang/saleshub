import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { formatCurrency } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron: find overdue invoices, update status, send reminders.
 * Only sends a reminder once every 3 days (checks last reminder via activities).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret");
  const isAuthed =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;

  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    // Find sent invoices past due date
    const { data: overdueInvoices, error } = await supabaseAdmin
      .from("invoices")
      .select("*, contacts(id, first_name, last_name, email, phone)")
      .in("status", ["sent", "overdue"])
      .lt("due_date", today);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!overdueInvoices?.length) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    let reminded = 0;
    let updated = 0;

    for (const invoice of overdueInvoices) {
      // Update status to overdue if not already
      if (invoice.status !== "overdue") {
        await supabaseAdmin
          .from("invoices")
          .update({ status: "overdue" })
          .eq("id", invoice.id);
        updated++;
      }

      const contact = invoice.contacts;
      if (!contact?.email) continue;

      // Check last reminder — only remind every 3 days
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentReminders } = await supabaseAdmin
        .from("activities")
        .select("id")
        .eq("contact_id", invoice.contact_id)
        .eq("type", "invoice_sent")
        .gte("created_at", threeDaysAgo)
        .limit(1);

      if (recentReminders && recentReminders.length > 0) {
        continue; // Already reminded recently
      }

      // Send reminder email
      const clientName = `${contact.first_name} ${contact.last_name ?? ""}`.trim();
      await sendEmail({
        to: contact.email,
        subject: `Payment Reminder: Invoice ${invoice.invoice_number}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#333">Payment Reminder</h2>
            <p>Hi ${clientName},</p>
            <p>This is a friendly reminder that invoice <strong>${invoice.invoice_number}</strong> for <strong>${formatCurrency(invoice.total)}</strong> is past due.</p>
            ${invoice.payment_link ? `<p><a href="${invoice.payment_link}" style="background:#0066ff;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Pay Now</a></p>` : ""}
            <p style="color:#666">If you have already made the payment, please ignore this reminder.</p>
            <hr style="margin:30px 0;border:none;border-top:1px solid #eee" />
            <p style="color:#999;font-size:12px">Expwave OPC Pvt. Ltd.</p>
          </div>
        `,
        tags: [{ name: "type", value: "invoice_reminder" }],
      });

      // Log activity
      await supabaseAdmin.from("activities").insert({
        contact_id: invoice.contact_id,
        type: "invoice_sent",
        title: `Payment reminder sent for ${invoice.invoice_number}`,
        body: `Overdue invoice reminder: ${formatCurrency(invoice.total)}`,
      });

      reminded++;
    }

    return NextResponse.json({
      success: true,
      processed: overdueInvoices.length,
      updated,
      reminded,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
