import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const addInstallmentsSchema = z.object({
  installments: z
    .array(
      z.object({
        installment_number: z.number().int().min(1).max(4),
        amount: z.number().min(0),
        due_date: z.string().min(1),
        status: z.enum(["pending", "paid"]).default("pending"),
        paid_at: z.string().optional(),
      })
    )
    .min(2)
    .max(4),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch existing invoice
  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("id, total, status, has_installments, contact_id")
    .eq("id", id)
    .single();

  if (fetchError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.has_installments) {
    return NextResponse.json(
      { error: "Invoice already has installments" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = addInstallmentsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { installments } = parsed.data;

  const installmentTotal = installments.reduce((sum, i) => sum + i.amount, 0);

  // Insert installments
  const installmentRows = installments.map((inst) => ({
    invoice_id: id,
    installment_number: inst.installment_number,
    amount: inst.amount,
    due_date: inst.due_date,
    status: inst.status,
    paid_at: inst.status === "paid" ? (inst.paid_at ?? new Date().toISOString()) : null,
    payment_gateway: inst.status === "paid" ? ("manual" as const) : null,
  }));

  const { error: instError } = await supabase
    .from("installments")
    .insert(installmentRows);

  if (instError) {
    return NextResponse.json({ error: instError.message }, { status: 500 });
  }

  // Check if all installments are paid
  const allPaid = installments.every((i) => i.status === "paid");
  const anyPending = installments.some((i) => i.status === "pending");

  // Update invoice — only set has_installments flag, don't change status or total
  await supabase.from("invoices").update({ has_installments: true }).eq("id", id);

  // Revalidate
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/customers");
  if (invoice.contact_id) revalidatePath(`/customers/${invoice.contact_id}`);

  return NextResponse.json({ success: true });
}
