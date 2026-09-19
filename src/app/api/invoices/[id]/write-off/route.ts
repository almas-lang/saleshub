import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateInvoicePages(id: string, contactId: string | null) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/finance");
  revalidatePath("/analytics");
  if (contactId) {
    revalidatePath(`/customers/${contactId}`);
  }
}

// Write off the unpaid balance: remaining installments -> written_off,
// invoice -> written_off. Paid installments and their income transactions
// are kept, so collected revenue and GST history stay intact.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("status, contact_id")
    .eq("id", id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (["paid", "cancelled", "written_off"].includes(invoice.status)) {
    return NextResponse.json(
      { error: `Cannot write off a ${invoice.status} invoice` },
      { status: 400 }
    );
  }

  const { error: instError } = await supabase
    .from("installments")
    .update({ status: "written_off" })
    .eq("invoice_id", id)
    .in("status", ["pending", "overdue"]);

  if (instError) {
    return NextResponse.json({ error: instError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "written_off" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateInvoicePages(id, invoice.contact_id);

  return NextResponse.json({ success: true });
}

// Reopen a written-off invoice: written_off installments -> pending,
// invoice -> sent. Reminder crons pick the pending installments back up.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("status, contact_id")
    .eq("id", id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status !== "written_off") {
    return NextResponse.json(
      { error: "Invoice is not written off" },
      { status: 400 }
    );
  }

  const { error: instError } = await supabase
    .from("installments")
    .update({ status: "pending" })
    .eq("invoice_id", id)
    .eq("status", "written_off");

  if (instError) {
    return NextResponse.json({ error: instError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "sent" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateInvoicePages(id, invoice.contact_id);

  return NextResponse.json({ success: true });
}
