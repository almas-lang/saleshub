import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { invoiceSchema } from "@/lib/validations";
import { calculateGST } from "@/lib/invoices/gst";
import type { InvoiceLineItem } from "@/types/invoices";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select("*, contacts(id, first_name, last_name, email, phone, company_name)")
    .eq("id", id)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const body = await request.json();

  // Extract paid_at before schema validation (it's not part of invoiceSchema)
  const manualPaidAt = body.paid_at;
  delete body.paid_at;

  const parsed = invoiceSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { customer_state, ...values } = parsed.data;

  const cleaned: Record<string, unknown> = {};

  // If items are being updated, recalculate GST
  if (values.items) {
    const items = values.items as InvoiceLineItem[];
    const gst = calculateGST(items, customer_state, values.gst_rate ?? 18);
    cleaned.items = JSON.stringify(items);
    cleaned.subtotal = gst.subtotal;
    cleaned.total = gst.total;
    cleaned.gst_rate = gst.gstRate;
    cleaned.gst_amount = gst.isIntraState ? gst.cgst + gst.sgst : gst.igst;
  }

  if (values.contact_id) cleaned.contact_id = values.contact_id;
  if (values.gst_number !== undefined) cleaned.gst_number = values.gst_number || null;
  if (values.due_date !== undefined) cleaned.due_date = values.due_date || null;
  if (values.notes !== undefined) cleaned.notes = values.notes || null;
  if (values.status) {
    cleaned.status = values.status;
    if (values.status === "paid") {
      cleaned.paid_at = manualPaidAt ? new Date(manualPaidAt).toISOString() : new Date().toISOString();
      cleaned.payment_gateway = "manual";
    }
  }
  if (values.type) cleaned.type = values.type;
  if (values.is_recurring !== undefined) cleaned.is_recurring = values.is_recurring;
  if (values.recurrence_day !== undefined) cleaned.recurrence_day = values.recurrence_day;

  const { error: updateError } = await supabase
    .from("invoices")
    .update(cleaned)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Fetch the updated invoice with contact info
  const { data } = await supabase
    .from("invoices")
    .select("*, contacts(id, first_name, last_name, email, phone, company_name)")
    .eq("id", id)
    .single();

  // If invoice was just marked paid, create an income transaction (if not already present)
  if (values.status === "paid" && data) {
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("invoice_id", id)
      .maybeSingle();

    if (!existing) {
      const paidDate = (cleaned.paid_at as string | undefined) ?? new Date().toISOString();
      await supabase.from("transactions").insert({
        type: "income",
        amount: data.total,
        category: "Invoice Payment",
        date: paidDate.split("T")[0],
        description: `Payment for ${data.invoice_number} via ${data.payment_gateway ?? "manual"}`,
        invoice_id: id,
        contact_id: data.contact_id,
      });
    }
  }

  // Revalidate pages that display invoice/payment data
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  if (data?.contact_id) {
    revalidatePath(`/customers/${data.contact_id}`);
  }
  revalidatePath("/customers");
  revalidatePath("/analytics");

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Only allow deleting draft or cancelled invoices
  const { data: invoice } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json(
      { error: "Cannot delete a paid invoice" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("invoices").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
