import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCashfreePaymentLink } from "@/lib/payments/cashfree";
import { createStripeCheckoutSession } from "@/lib/payments/stripe";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const body = await request.json();
  const gateway: string = body.gateway ?? "cashfree";

  // Fetch invoice + contact
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, contacts(id, first_name, last_name, email, phone)")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const contact = invoice.contacts;
  if (!contact?.email) {
    return NextResponse.json(
      { error: "Contact must have an email for payment link" },
      { status: 400 }
    );
  }

  const clientName = `${contact.first_name} ${contact.last_name ?? ""}`.trim();
  let paymentLink: string | undefined;

  if (gateway === "stripe") {
    const result = await createStripeCheckoutSession(
      id,
      invoice.total,
      contact.email,
      `Invoice ${invoice.invoice_number}`
    );
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    paymentLink = result.checkoutUrl;
  } else {
    const result = await createCashfreePaymentLink(
      id,
      invoice.total,
      contact.email,
      contact.phone ?? "",
      clientName
    );
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    paymentLink = result.paymentLink;
  }

  // Save payment link to invoice
  if (paymentLink) {
    await supabase
      .from("invoices")
      .update({ payment_link: paymentLink })
      .eq("id", id);
  }

  return NextResponse.json({ payment_link: paymentLink });
}
