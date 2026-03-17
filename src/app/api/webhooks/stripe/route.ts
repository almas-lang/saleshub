import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { constructStripeEvent } from "@/lib/payments/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  const event = constructStripeEvent(rawBody, signature);

  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const eventData = event as Record<string, any>;
  const session = eventData.data?.object as { metadata?: { invoice_id?: string }; id: string };
  const invoiceId = session.metadata?.invoice_id;

  if (!invoiceId) {
    console.error("[Stripe Webhook] No invoice_id in session metadata");
    return NextResponse.json({ received: true });
  }

  // Fetch invoice
  const { data: invoice } = await supabaseAdmin
    .from("invoices")
    .select("id, contact_id, status, invoice_number, total")
    .eq("id", invoiceId)
    .single();

  if (!invoice) {
    console.error("[Stripe Webhook] Invoice not found:", invoiceId);
    return NextResponse.json({ received: true });
  }

  // Idempotency: skip if already paid
  if (invoice.status === "paid") {
    return NextResponse.json({ received: true, already_paid: true });
  }

  // Mark invoice as paid
  await supabaseAdmin
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_gateway: "stripe",
      payment_id: session.id,
    })
    .eq("id", invoice.id);

  // Log activity
  await supabaseAdmin.from("activities").insert({
    contact_id: invoice.contact_id,
    type: "payment_received",
    title: `Payment received for ${invoice.invoice_number}`,
    body: `₹${invoice.total.toLocaleString("en-IN")} paid via Stripe`,
  });

  // Create income transaction
  await supabaseAdmin.from("transactions").insert({
    type: "income",
    amount: invoice.total,
    category: "Invoice Payment",
    date: new Date().toISOString().split("T")[0],
    description: `Payment for ${invoice.invoice_number} via Stripe`,
    invoice_id: invoice.id,
    contact_id: invoice.contact_id,
  });

  return NextResponse.json({ received: true, invoice_id: invoice.id });
}
