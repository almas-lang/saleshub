import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const markPaidSchema = z.object({
  status: z.literal("paid"),
  paid_at: z.string().optional(),
  payment_id: z.string().trim().max(120).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; instId: string }> }
) {
  const { id, instId } = await params;
  const supabase = await createClient();

  const body = await request.json();
  const parsed = markPaidSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data: installment, error: fetchError } = await supabase
    .from("installments")
    .select("id, invoice_id, installment_number, amount, status")
    .eq("id", instId)
    .eq("invoice_id", id)
    .single();

  if (fetchError || !installment) {
    return NextResponse.json({ error: "Installment not found" }, { status: 404 });
  }

  if (installment.status === "paid") {
    return NextResponse.json({ success: true, already_paid: true });
  }

  const paidAt = parsed.data.paid_at
    ? new Date(parsed.data.paid_at).toISOString()
    : new Date().toISOString();

  const { count, error: updateError } = await supabase
    .from("installments")
    .update(
      {
        status: "paid",
        paid_at: paidAt,
        payment_gateway: "manual",
        payment_id: parsed.data.payment_id?.length ? parsed.data.payment_id : null,
      },
      { count: "exact" }
    )
    .eq("id", installment.id)
    .neq("status", "paid");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json({ success: true, already_paid: true });
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, contact_id, invoice_number, total")
    .eq("id", installment.invoice_id)
    .single();

  if (!invoice) {
    return NextResponse.json({ success: true });
  }

  const { data: allInstallments } = await supabase
    .from("installments")
    .select("id, status")
    .eq("invoice_id", invoice.id);

  const totalInstallments = allInstallments?.length ?? 0;
  const allPaid = !!allInstallments?.length && allInstallments.every((i) => i.status === "paid");

  if (allPaid) {
    await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: paidAt,
        payment_gateway: "manual",
      })
      .eq("id", invoice.id);
  }

  const refSuffix = parsed.data.payment_id?.length ? ` (Ref: ${parsed.data.payment_id})` : "";

  await supabase.from("activities").insert({
    contact_id: invoice.contact_id,
    type: "payment_received",
    title: `Installment ${installment.installment_number}/${totalInstallments} paid for ${invoice.invoice_number}`,
    body: `₹${installment.amount.toLocaleString("en-IN")} paid via UPI${refSuffix}`,
  });

  await supabase.from("transactions").insert({
    type: "income",
    amount: installment.amount,
    category: "Invoice Payment",
    date: paidAt.split("T")[0],
    description: `Installment ${installment.installment_number}/${totalInstallments} for ${invoice.invoice_number} via UPI${refSuffix}`,
    invoice_id: invoice.id,
    contact_id: invoice.contact_id,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoice.id}`);
  revalidatePath("/customers");
  if (invoice.contact_id) revalidatePath(`/customers/${invoice.contact_id}`);
  revalidatePath("/analytics");

  return NextResponse.json({
    success: true,
    installment_id: installment.id,
    all_paid: allPaid,
  });
}
