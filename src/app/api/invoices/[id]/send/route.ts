import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { formatCurrency } from "@/lib/utils";
import { calculateGST } from "@/lib/invoices/gst";
import { parseInvoiceItems } from "@/types/invoices";
import type { Installment } from "@/types/invoices";

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  let includePaymentLink = true;
  try {
    const body = await request.json();
    includePaymentLink = body.include_payment_link !== false;
  } catch {
    // No body or invalid JSON — default to true
  }

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, contacts(id, first_name, last_name, email, phone, company_name)")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const contact = invoice.contacts;
  if (!contact?.email) {
    return NextResponse.json(
      { error: "Contact must have an email to send invoice" },
      { status: 400 }
    );
  }

  const clientName = `${contact.first_name} ${contact.last_name ?? ""}`.trim();
  const items = parseInvoiceItems(invoice.items);
  const gst = calculateGST(items, null, invoice.gst_rate ?? 18);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pdfUrl = `${appUrl}/api/invoices/${id}/pdf`;

  // Generate payment link if requested and not already set
  let paymentLink = invoice.payment_link;
  let paymentLinkError: string | undefined;
  if (includePaymentLink && !paymentLink) {
    paymentLink = `${appUrl}/pay/${id}`;
    await supabaseAdmin
      .from("invoices")
      .update({ payment_link: paymentLink, payment_gateway: "cashfree" })
      .eq("id", id);
  }

  // If user chose not to include payment link, don't show it in email
  if (!includePaymentLink) {
    paymentLink = null;
  }

  // Build line items rows
  const itemRows = items.map((item, i) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#666;font-size:13px">${i + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px">${item.description}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-size:13px">${item.qty}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-size:13px">${formatCurrency(item.rate)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;font-size:13px">${formatCurrency(item.amount)}</td>
    </tr>
  `).join("");

  // GST rows
  let gstRows = "";
  if (gst.isIntraState) {
    gstRows = `
      <tr><td style="padding:4px 0;color:#666;font-size:13px">CGST (${gst.gstRate / 2}%)</td><td style="padding:4px 0;text-align:right;color:#666;font-size:13px">${formatCurrency(gst.cgst)}</td></tr>
      <tr><td style="padding:4px 0;color:#666;font-size:13px">SGST (${gst.gstRate / 2}%)</td><td style="padding:4px 0;text-align:right;color:#666;font-size:13px">${formatCurrency(gst.sgst)}</td></tr>
    `;
  } else if (gst.igst > 0) {
    gstRows = `
      <tr><td style="padding:4px 0;color:#666;font-size:13px">IGST (${gst.gstRate}%)</td><td style="padding:4px 0;text-align:right;color:#666;font-size:13px">${formatCurrency(gst.igst)}</td></tr>
    `;
  }

  // Fetch installments early so we can use them for both the button and schedule
  let installmentRows: Installment[] = [];
  if (invoice.has_installments) {
    const { data } = await supabaseAdmin
      .from("installments")
      .select("*")
      .eq("invoice_id", id)
      .order("installment_number", { ascending: true });
    installmentRows = (data ?? []) as Installment[];
  }

  // For installment invoices, show first pending installment amount + link
  let payButtonAmount = invoice.total;
  let payButtonLink = paymentLink;
  let payButtonLabel = `Pay Now — ${formatCurrency(invoice.total)}`;
  if (invoice.has_installments && installmentRows.length > 0 && paymentLink) {
    const firstPending = installmentRows.find((i) => i.status === "pending" || i.status === "overdue");
    if (firstPending) {
      payButtonAmount = firstPending.amount;
      payButtonLink = `${paymentLink}?inst=${firstPending.id}`;
      payButtonLabel = `Pay Installment ${firstPending.installment_number} — ${formatCurrency(firstPending.amount)}`;
    }
  }

  const paymentButton = payButtonLink
    ? `<div style="text-align:center;margin:24px 0"><a href="${payButtonLink}" style="display:inline-block;background:#0066ff;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">${payButtonLabel}</a></div>`
    : "";

  // Build installment schedule section if applicable
  let installmentScheduleHtml = "";
  if (invoice.has_installments) {
    const installments = installmentRows;

    if (installments?.length) {
      const scheduleRows = installments.map((inst: Installment) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px">Installment ${inst.installment_number}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;font-size:13px">${formatCurrency(inst.amount)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-size:13px">${fmtDate(inst.due_date)}</td>
        </tr>`
      ).join("");

      installmentScheduleHtml = `
        <div style="margin:20px 0">
          <p style="margin:0 0 8px;font-size:10px;font-weight:bold;color:#999;text-transform:uppercase;letter-spacing:0.5px">Payment Schedule</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <thead>
              <tr style="border-bottom:2px solid #e0e0e0">
                <th style="padding:6px 10px;text-align:left;font-size:11px;color:#888;font-weight:600">Installment</th>
                <th style="padding:6px 10px;text-align:right;font-size:11px;color:#888;font-weight:600">Amount</th>
                <th style="padding:6px 10px;text-align:right;font-size:11px;color:#888;font-weight:600">Due Date</th>
              </tr>
            </thead>
            <tbody>${scheduleRows}</tbody>
          </table>
        </div>
      `;
    }
  }

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <!-- Header -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
        <tr>
          <td>
            <h2 style="margin:0;font-size:18px;color:#111">EXPWAVE PVT. LTD.</h2>
            <p style="margin:2px 0 0;font-size:11px;color:#888">328, 6th main AECS B Block Singasandra Bangalore 560068</p>
            <p style="margin:2px 0 0;font-size:11px;color:#888">GSTIN: 29AAHCE9805F1ZE | PAN: AAHCE9805F</p>
          </td>
          <td style="text-align:right;vertical-align:top">
            <p style="margin:0;font-size:20px;font-weight:bold;color:#111">INVOICE</p>
            <p style="margin:4px 0 0;font-size:13px;font-weight:600">${invoice.invoice_number}</p>
            <p style="margin:2px 0 0;font-size:12px;color:#888">Date: ${fmtDate(invoice.created_at)}</p>
            ${invoice.due_date ? `<p style="margin:2px 0 0;font-size:12px;color:#888">Due: ${fmtDate(invoice.due_date)}</p>` : ""}
          </td>
        </tr>
      </table>

      <!-- Bill To -->
      <div style="background:#f7f7f7;padding:14px 16px;border-radius:6px;margin-bottom:20px">
        <p style="margin:0 0 4px;font-size:10px;font-weight:bold;color:#999;text-transform:uppercase;letter-spacing:0.5px">Bill To</p>
        <p style="margin:0;font-size:14px;font-weight:600">${clientName}</p>
        ${contact.company_name ? `<p style="margin:2px 0 0;font-size:12px;color:#666">${contact.company_name}</p>` : ""}
        ${contact.email ? `<p style="margin:2px 0 0;font-size:12px;color:#666">${contact.email}</p>` : ""}
        ${contact.phone ? `<p style="margin:2px 0 0;font-size:12px;color:#666">${contact.phone}</p>` : ""}
        ${invoice.gst_number ? `<p style="margin:2px 0 0;font-size:12px;color:#666">GSTIN: ${invoice.gst_number}</p>` : ""}
      </div>

      <!-- Items Table -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr style="border-bottom:2px solid #e0e0e0">
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#888;font-weight:600">#</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#888;font-weight:600">Description</th>
            <th style="padding:8px 10px;text-align:right;font-size:11px;color:#888;font-weight:600">Qty</th>
            <th style="padding:8px 10px;text-align:right;font-size:11px;color:#888;font-weight:600">Rate</th>
            <th style="padding:8px 10px;text-align:right;font-size:11px;color:#888;font-weight:600">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Totals -->
      <table width="280" cellpadding="0" cellspacing="0" style="margin-left:auto;border-collapse:collapse">
        <tr><td style="padding:4px 0;font-size:13px">Subtotal</td><td style="padding:4px 0;text-align:right;font-weight:600;font-size:13px">${formatCurrency(gst.subtotal)}</td></tr>
        ${gstRows}
        <tr style="border-top:2px solid #333">
          <td style="padding:8px 0;font-size:15px;font-weight:bold">Total</td>
          <td style="padding:8px 0;text-align:right;font-size:15px;font-weight:bold">${formatCurrency(gst.total)}</td>
        </tr>
      </table>

      ${paymentButton}

      ${installmentScheduleHtml}

      <!-- Notes -->
      ${invoice.notes ? `
        <div style="background:#f7f7f7;padding:12px 16px;border-radius:6px;margin:20px 0">
          <p style="margin:0 0 4px;font-size:10px;font-weight:bold;color:#999;text-transform:uppercase;letter-spacing:0.5px">Notes</p>
          <p style="margin:0;font-size:12px;white-space:pre-wrap">${invoice.notes}</p>
        </div>
      ` : ""}

      <!-- Bank Details + QR -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e0e0e0;padding-top:16px;margin-top:20px">
        <tr>
          <td style="vertical-align:top">
            <p style="margin:0 0 6px;font-size:10px;font-weight:bold;color:#999;text-transform:uppercase;letter-spacing:0.5px">Bank Details</p>
            <table cellpadding="0" cellspacing="0" style="font-size:12px;color:#666">
              <tr><td style="padding:1px 0">Bank: HDFC Bank, Halasuru Branch</td></tr>
              <tr><td style="padding:1px 0">A/c No: 5020 0090 0123 75</td></tr>
              <tr><td style="padding:1px 0">IFSC: HDFC0000286</td></tr>
              <tr><td style="padding:1px 0">UPI: expwave@ybl</td></tr>
            </table>
          </td>
          <td style="vertical-align:top;text-align:right;width:140px">
            <img src="${appUrl}/images/upi-qr.png" alt="Scan to Pay (UPI)" width="120" height="120" style="display:block;margin-left:auto;border-radius:6px" />
            <p style="margin:4px 0 0;font-size:10px;color:#999;text-align:center">Scan to Pay (UPI)</p>
          </td>
        </tr>
      </table>

      <!-- Download PDF link -->
      <div style="text-align:center;margin:24px 0 8px">
        <a href="${pdfUrl}" style="color:#0066ff;font-size:13px;text-decoration:underline" target="_blank">Download PDF</a>
      </div>

      <hr style="margin:20px 0;border:none;border-top:1px solid #eee" />
      <p style="color:#999;font-size:11px;text-align:center">Expwave Pvt. Ltd. | GSTIN: 29AAHCE9805F1ZE</p>
    </div>
  `;

  const emailResult = await sendEmail({
    to: contact.email,
    subject: `Invoice ${invoice.invoice_number} from Xperience Wave`,
    html,
    tags: [{ name: "type", value: "invoice" }],
  });

  if (!emailResult.success) {
    return NextResponse.json({ error: emailResult.error }, { status: 500 });
  }

  if (invoice.status === "draft") {
    await supabaseAdmin
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", id);
  }

  await supabaseAdmin.from("activities").insert({
    contact_id: invoice.contact_id,
    type: "invoice_sent",
    title: `Invoice ${invoice.invoice_number} sent`,
    body: `${formatCurrency(invoice.total)} invoice sent to ${contact.email}`,
  });

  return NextResponse.json({
    success: true,
    email_sent: true,
    payment_link_included: !!paymentLink,
    payment_link_error: paymentLinkError,
  });
}
