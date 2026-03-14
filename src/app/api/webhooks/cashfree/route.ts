import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyCashfreeSignature } from "@/lib/payments/cashfree";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-cashfree-signature") ?? "";

  // Verify signature (skip in sandbox if secret not set)
  if (process.env.CASHFREE_SECRET_KEY && signature) {
    if (!verifyCashfreeSignature(rawBody, signature)) {
      console.error("[Cashfree Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const payload = JSON.parse(rawBody);
  const eventType = payload.type;

  console.log("[Cashfree Webhook] Event:", eventType, JSON.stringify(payload).slice(0, 500));

  // Handle Payment Link events (from notify_url)
  if (eventType === "PAYMENT_LINK_EVENT") {
    const linkId = payload.data?.link_id;
    const linkStatus = payload.data?.link_status;

    if (linkStatus !== "PAID") {
      return NextResponse.json({ received: true });
    }

    return handlePaid(linkId, payload.data?.cf_link_id ?? linkId, "link_id");
  }

  // Handle "success payment" global webhook event
  if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
    const orderId = payload.data?.order?.order_id;
    const paymentId = payload.data?.payment?.cf_payment_id;

    if (!orderId) {
      console.error("[Cashfree Webhook] No order_id in success event");
      return NextResponse.json({ received: true });
    }

    // Our link_id format is `inv_{8chars}_{timestamp}`, which becomes the order_id
    return handlePaid(orderId, String(paymentId ?? orderId), "order_id");
  }

  return NextResponse.json({ received: true });
}

async function handlePaid(lookupId: string, paymentId: string, matchBy: string) {
  // Try to find invoice by payment_link containing the ID, or by link stored separately
  let invoice;

  const { data } = await supabaseAdmin
    .from("invoices")
    .select("id, contact_id, status, invoice_number, total")
    .like("payment_link", `%${lookupId}%`)
    .single();

  invoice = data;

  // If no match by payment_link, try matching the order_id pattern (inv_{uuid_prefix}_{ts})
  if (!invoice && lookupId.startsWith("inv_")) {
    const uuidPrefix = lookupId.split("_")[1]; // first 8 chars of invoice UUID
    if (uuidPrefix) {
      const { data: fallback } = await supabaseAdmin
        .from("invoices")
        .select("id, contact_id, status, invoice_number, total")
        .like("id", `${uuidPrefix}%`)
        .single();
      invoice = fallback;
    }
  }

  if (!invoice) {
    console.error(`[Cashfree Webhook] No invoice found for ${matchBy}:`, lookupId);
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
      payment_gateway: "cashfree",
      payment_id: paymentId,
    })
    .eq("id", invoice.id);

  // Log activity on contact
  await supabaseAdmin.from("activities").insert({
    contact_id: invoice.contact_id,
    type: "payment_received",
    title: `Payment received for ${invoice.invoice_number}`,
    body: `₹${invoice.total.toLocaleString("en-IN")} paid via Cashfree`,
  });

  console.log(`[Cashfree Webhook] Invoice ${invoice.invoice_number} marked as paid`);
  return NextResponse.json({ received: true, invoice_id: invoice.id });
}
