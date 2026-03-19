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

/**
 * Extract installment UUID from order ID format "inst-{uuid}" or "inst-{uuid}-{suffix}".
 */
function extractInstallmentId(lookupId: string): string | null {
  if (!lookupId.startsWith("inst-")) return null;
  const rest = lookupId.slice(5);
  const uuidMatch = rest.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (uuidMatch) return uuidMatch[1];
  if (/^[0-9a-f-]{36}$/i.test(rest)) return rest;
  return null;
}

async function handlePaid(lookupId: string, paymentId: string) {
  // Check if this is an installment payment
  const installmentId = extractInstallmentId(lookupId);
  if (installmentId) {
    return handleInstallmentPaid(installmentId, paymentId);
  }

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

  // Atomic update — only succeeds if status is NOT already "paid"
  // This prevents duplicate processing when webhooks fire twice
  const { count } = await supabaseAdmin
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_gateway: "cashfree",
      payment_id: paymentId,
    }, { count: "exact" })
    .eq("id", invoice.id)
    .neq("status", "paid");

  // If no rows updated, another webhook already processed this
  if (!count) {
    console.log(`[Cashfree Webhook] Invoice ${invoice.invoice_number} already processed (race)`);
    return NextResponse.json({ received: true, already_paid: true });
  }

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

async function handleInstallmentPaid(installmentId: string, paymentId: string) {
  // Fetch the installment with its invoice
  const { data: installment } = await supabaseAdmin
    .from("installments")
    .select("id, invoice_id, installment_number, amount, status")
    .eq("id", installmentId)
    .single();

  if (!installment) {
    console.error(`[Cashfree Webhook] No installment found for:`, installmentId);
    return NextResponse.json({ received: true });
  }

  // Idempotency: skip if already paid
  if (installment.status === "paid") {
    return NextResponse.json({ received: true, already_paid: true });
  }

  // Mark installment as paid
  const { count } = await supabaseAdmin
    .from("installments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_gateway: "cashfree",
      payment_id: paymentId,
    }, { count: "exact" })
    .eq("id", installment.id)
    .neq("status", "paid");

  if (!count) {
    return NextResponse.json({ received: true, already_paid: true });
  }

  // Fetch invoice details
  const { data: invoice } = await supabaseAdmin
    .from("invoices")
    .select("id, contact_id, invoice_number, total")
    .eq("id", installment.invoice_id)
    .single();

  if (!invoice) {
    return NextResponse.json({ received: true });
  }

  // Check if ALL installments for this invoice are now paid
  const { data: allInstallments } = await supabaseAdmin
    .from("installments")
    .select("id, status")
    .eq("invoice_id", invoice.id);

  const allPaid = allInstallments?.every((i) => i.status === "paid" || i.id === installment.id);

  if (allPaid) {
    // Mark parent invoice as paid
    await supabaseAdmin
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        payment_gateway: "cashfree",
      })
      .eq("id", invoice.id);
  }

  const totalInstallments = allInstallments?.length ?? 0;

  // Log activity
  await supabaseAdmin.from("activities").insert({
    contact_id: invoice.contact_id,
    type: "payment_received",
    title: `Installment ${installment.installment_number}/${totalInstallments} paid for ${invoice.invoice_number}`,
    body: `₹${installment.amount.toLocaleString("en-IN")} paid via Cashfree`,
  });

  // Create income transaction
  await supabaseAdmin.from("transactions").insert({
    type: "income",
    amount: installment.amount,
    category: "Invoice Payment",
    date: new Date().toISOString().split("T")[0],
    description: `Installment ${installment.installment_number}/${totalInstallments} for ${invoice.invoice_number} via Cashfree`,
    invoice_id: invoice.id,
    contact_id: invoice.contact_id,
  });

  console.log(`[Cashfree Webhook] Installment ${installment.installment_number}/${totalInstallments} for ${invoice.invoice_number} marked as paid${allPaid ? " (all paid)" : ""}`);
  return NextResponse.json({ received: true, installment_id: installment.id, all_paid: allPaid });
}
