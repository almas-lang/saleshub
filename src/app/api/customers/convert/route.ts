import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { convertToCustomerSchema } from "@/lib/validations";
import { getNextInvoiceNumber } from "@/lib/invoices/utils";

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json();
  const parsed = convertToCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const {
    contact_id,
    program_name,
    amount,
    start_date,
    sessions_total,
    mentor_id,
    notes,
    create_invoice,
  } = parsed.data;

  // 1. Update contact type to "customer", set converted_at, move to terminal stage
  // Find the contact's current funnel to look for a terminal/won stage
  const { data: currentContact } = await supabase
    .from("contacts")
    .select("funnel_id")
    .eq("id", contact_id)
    .single();

  let terminalStageId: string | null = null;
  if (currentContact?.funnel_id) {
    const { data: wonStage } = await supabase
      .from("funnel_stages")
      .select("id")
      .eq("funnel_id", currentContact.funnel_id)
      .eq("is_terminal", true)
      .limit(1)
      .maybeSingle();
    terminalStageId = wonStage?.id ?? null;
  }

  const contactUpdate: Record<string, unknown> = {
    type: "customer",
    converted_at: new Date().toISOString(),
  };
  if (terminalStageId) {
    contactUpdate.current_stage_id = terminalStageId;
  }

  const { error: updateError } = await supabase
    .from("contacts")
    .update(contactUpdate)
    .eq("id", contact_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 2. Create customer_programs record
  const { data: program, error: programError } = await supabase
    .from("customer_programs")
    .insert({
      contact_id,
      program_name,
      amount: amount ?? null,
      start_date: start_date || null,
      sessions_total: sessions_total ?? null,
      sessions_completed: 0,
      mentor_id: mentor_id || null,
      notes: notes || null,
      status: "active",
    })
    .select()
    .single();

  if (programError) {
    return NextResponse.json({ error: programError.message }, { status: 500 });
  }

  // 3. Stop all active drip enrollments (prospect nurture no longer relevant)
  await supabaseAdmin
    .from("drip_enrollments")
    .update({ status: "stopped", stopped_reason: "converted_to_customer" })
    .eq("contact_id", contact_id)
    .in("status", ["active", "paused"]);

  // 4. Log activity
  await supabase.from("activities").insert({
    contact_id,
    type: "stage_change",
    title: "Converted to Customer",
    body: `Enrolled in ${program_name}${amount ? ` (₹${amount.toLocaleString("en-IN")})` : ""}`,
  });

  // 4. Optionally create a draft invoice
  let invoice = null;
  if (create_invoice && amount) {
    const invoiceNumber = await getNextInvoiceNumber("invoice");
    const { data: inv } = await supabase
      .from("invoices")
      .insert({
        contact_id,
        invoice_number: invoiceNumber,
        items: JSON.stringify([
          {
            description: program_name,
            sac_code: "999293",
            qty: 1,
            rate: amount,
            amount: amount,
          },
        ]),
        subtotal: amount,
        total: amount, // GST will be recalculated when editing
        status: "draft",
        type: "invoice",
      })
      .select()
      .single();
    invoice = inv;
  }

  return NextResponse.json(
    { program, invoice, message: "Customer converted successfully" },
    { status: 201 }
  );
}
