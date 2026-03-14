import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getNextInvoiceNumber } from "@/lib/invoices/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron: check recurring invoices and generate new ones
 * when today matches the recurrence_day.
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
    const today = new Date().getDate();

    // Find recurring invoices due today
    const { data: recurringInvoices, error } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("is_recurring", true)
      .eq("recurrence_day", today)
      .in("status", ["paid", "sent"]); // Only create from active recurring invoices

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!recurringInvoices?.length) {
      return NextResponse.json({ success: true, created: 0 });
    }

    let created = 0;

    for (const template of recurringInvoices) {
      const invoiceNumber = await getNextInvoiceNumber("invoice");

      const { error: insertError } = await supabaseAdmin
        .from("invoices")
        .insert({
          contact_id: template.contact_id,
          invoice_number: invoiceNumber,
          items: template.items,
          subtotal: template.subtotal,
          total: template.total,
          gst_rate: template.gst_rate,
          gst_amount: template.gst_amount,
          gst_number: template.gst_number,
          notes: template.notes,
          type: "invoice",
          status: "draft",
          due_date: new Date(
            Date.now() + 15 * 24 * 60 * 60 * 1000
          ).toISOString().split("T")[0], // 15 days from now
        });

      if (insertError) {
        console.error(`[Recurring Invoice] Failed to create for ${template.id}:`, insertError.message);
      } else {
        created++;
      }
    }

    return NextResponse.json({ success: true, created });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
