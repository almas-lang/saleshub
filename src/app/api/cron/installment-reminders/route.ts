import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { sendTemplate } from "@/lib/whatsapp/client";
import { formatCurrency } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron: send reminders for installments due in 0–2 days.
 * Sends email + WhatsApp (xw_payment_reminder template).
 * Throttle: 20h between reminders for the same installment.
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
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const dayAfterTomorrow = new Date(now);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const maxDate = dayAfterTomorrow.toISOString().split("T")[0];

    // Fetch pending installments due within 0-2 days, with invoice and contact info
    const { data: installments, error } = await supabaseAdmin
      .from("installments")
      .select("id, invoice_id, installment_number, amount, due_date, status")
      .eq("status", "pending")
      .gte("due_date", today)
      .lte("due_date", maxDate);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!installments?.length) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    // Get unique invoice IDs
    const invoiceIds = [...new Set(installments.map((i) => i.invoice_id))];

    // Fetch invoices with contacts
    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, contact_id, has_installments, contacts(id, first_name, last_name, email, phone)")
      .in("id", invoiceIds);

    const invoiceMap = new Map((invoices ?? []).map((inv) => [inv.id, inv]));

    // Count total installments per invoice for "X of Y" display
    const { data: allInstallments } = await supabaseAdmin
      .from("installments")
      .select("invoice_id")
      .in("invoice_id", invoiceIds);

    const totalCountMap = new Map<string, number>();
    for (const inst of allInstallments ?? []) {
      totalCountMap.set(inst.invoice_id, (totalCountMap.get(inst.invoice_id) ?? 0) + 1);
    }

    let reminded = 0;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    for (const inst of installments) {
      const invoice = invoiceMap.get(inst.invoice_id);
      if (!invoice) continue;

      const contact = invoice.contacts as unknown as {
        id: string;
        first_name: string;
        last_name: string | null;
        email: string | null;
        phone: string | null;
      } | null;

      if (!contact) continue;

      // Calculate days until due
      const dueDate = new Date(inst.due_date + "T00:00:00");
      const diffMs = dueDate.getTime() - now.getTime();
      const daysUntil = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

      let dueContext: string;
      if (daysUntil <= 0) {
        dueContext = "today";
      } else if (daysUntil === 1) {
        dueContext = "tomorrow";
      } else {
        dueContext = "in 2 days";
      }

      // Throttle check: skip if reminder sent in last 20 hours
      const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
      const { data: recentReminders } = await supabaseAdmin
        .from("activities")
        .select("id")
        .eq("contact_id", invoice.contact_id)
        .eq("type", "installment_reminder")
        .gte("created_at", twentyHoursAgo)
        .ilike("title", `%${inst.id.slice(0, 8)}%`)
        .limit(1);

      if (recentReminders && recentReminders.length > 0) {
        continue;
      }

      const clientName = `${contact.first_name} ${contact.last_name ?? ""}`.trim();
      const totalCount = totalCountMap.get(inst.invoice_id) ?? 0;
      const payLink = `${appUrl}/pay/${inst.invoice_id}?inst=${inst.id}`;
      const formattedAmount = formatCurrency(inst.amount);

      // Format due date for display
      const dueDateDisplay = new Date(inst.due_date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      // Send email reminder
      if (contact.email) {
        await sendEmail({
          to: contact.email,
          subject: `Payment Reminder: Installment ${inst.installment_number}/${totalCount} for ${invoice.invoice_number}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#333">Payment Reminder</h2>
              <p>Hi ${clientName},</p>
              <p>This is a reminder that your payment of <strong>${formattedAmount}</strong> (installment ${inst.installment_number} of ${totalCount}) for invoice <strong>${invoice.invoice_number}</strong> is due <strong>${dueContext}</strong> (${dueDateDisplay}).</p>
              <p><a href="${payLink}" style="display:inline-block;background:#0066ff;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Pay Now — ${formattedAmount}</a></p>
              <p style="color:#666">If you have already made the payment, please ignore this reminder.</p>
              <hr style="margin:30px 0;border:none;border-top:1px solid #eee" />
              <p style="color:#999;font-size:12px">Expwave Pvt. Ltd.</p>
            </div>
          `,
          tags: [{ name: "type", value: "installment_reminder" }],
        });
      }

      // Send WhatsApp reminder (will fail silently if template not approved yet)
      if (contact.phone) {
        try {
          await sendTemplate(contact.phone, "xw_payment_reminder", [
            clientName,
            formattedAmount,
            invoice.invoice_number,
            String(inst.installment_number),
            String(totalCount),
            dueContext,
            payLink,
          ]);
        } catch {
          // Template may not be approved yet — email is the primary channel
        }
      }

      // Log activity + email_sends
      const inserts: PromiseLike<unknown>[] = [
        supabaseAdmin.from("activities").insert({
          contact_id: invoice.contact_id,
          type: "installment_reminder",
          title: `Installment reminder sent [${inst.id.slice(0, 8)}]`,
          body: `${formattedAmount} due ${dueContext} — installment ${inst.installment_number}/${totalCount} for ${invoice.invoice_number}`,
        }),
      ];
      if (contact.email) {
        inserts.push(
          supabaseAdmin.from("email_sends").insert({
            contact_id: invoice.contact_id,
            status: "sent",
            sent_at: new Date().toISOString(),
          })
        );
      }
      await Promise.all(inserts);

      reminded++;
    }

    return NextResponse.json({
      success: true,
      processed: installments.length,
      reminded,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
