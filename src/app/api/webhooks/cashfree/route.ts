import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyCashfreeSignature } from "@/lib/payments/cashfree";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-cashfree-signature") ?? "";

  // Verify signature in production only — sandbox uses different signing
  const isSandbox = process.env.CASHFREE_ENV !== "production";
  if (!isSandbox && process.env.CASHFREE_SECRET_KEY && signature) {
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

    return handlePaid(linkId, payload.data?.cf_link_id ?? linkId);
  }

  // Handle "success payment" global webhook event
  if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
    const orderId = payload.data?.order?.order_id;
    const paymentId = payload.data?.payment?.cf_payment_id;

    if (!orderId) {
      console.error("[Cashfree Webhook] No order_id in success event");
      return NextResponse.json({ received: true });
    }

    return handlePaid(orderId, String(paymentId ?? orderId));
  }

  return NextResponse.json({ received: true });
}

/**
 * Extract invoice UUID from our link_id format.
 * Supports both old format "inv-{uuid}" and new format "inv-{uuid-prefix}-{suffix}".
 * UUIDs are 36 chars (with hyphens): xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
function extractInvoiceId(linkId: string): string | null {
  if (!linkId.startsWith("inv-")) return null;
  const rest = linkId.slice(4);

  // Try full UUID (36 chars with hyphens)
  const uuidMatch = rest.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (uuidMatch) return uuidMatch[1];

  // Old format: the rest IS the full UUID
  if (/^[0-9a-f-]{36}$/i.test(rest)) return rest;

  return null;
}

async function handlePaid(lookupId: string, paymentId: string) {
  let invoice;

  // Try direct UUID lookup (new format: inv-{uuid})
  const invoiceId = extractInvoiceId(lookupId);
  if (invoiceId) {
    const { data } = await supabaseAdmin
      .from("invoices")
      .select("id, contact_id, status, invoice_number, total")
      .eq("id", invoiceId)
      .single();
    invoice = data;
  }

  // Fallback: search by payment_link URL containing the lookup ID
  if (!invoice) {
    const { data } = await supabaseAdmin
      .from("invoices")
      .select("id, contact_id, status, invoice_number, total")
      .like("payment_link", `%${lookupId}%`)
      .single();
    invoice = data;
  }

  if (!invoice) {
    console.error(`[Cashfree Webhook] No invoice found for:`, lookupId);
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

  // Create income transaction
  await supabaseAdmin.from("transactions").insert({
    type: "income",
    amount: invoice.total,
    category: "Invoice Payment",
    date: new Date().toISOString().split("T")[0],
    description: `Payment for ${invoice.invoice_number} via Cashfree`,
    invoice_id: invoice.id,
    contact_id: invoice.contact_id,
  });

  console.log(`[Cashfree Webhook] Invoice ${invoice.invoice_number} marked as paid`);
  return NextResponse.json({ received: true, invoice_id: invoice.id });
}
