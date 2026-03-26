export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculateGST } from "@/lib/invoices/gst";
import { amountInWords } from "@/lib/invoices/utils";
import { InvoicePDF } from "@/lib/pdf/invoice-template";
import { parseInvoiceItems } from "@/types/invoices";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, contacts(id, first_name, last_name, email, phone, company_name)")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json(
      { error: error?.message ?? "Invoice not found" },
      { status: 404 }
    );
  }

  const items = parseInvoiceItems(invoice.items);
  const gst = calculateGST(items, null, invoice.gst_rate ?? 18);
  const contact = invoice.contacts;
  const clientName = contact
    ? `${contact.first_name} ${contact.last_name ?? ""}`.trim()
    : "Unknown";

  // Read UPI QR code image
  let qrCodeDataUrl: string | undefined;
  try {
    const qrPath = join(process.cwd(), "public/images/upi-qr.png");
    const qrBuffer = await readFile(qrPath);
    qrCodeDataUrl = `data:image/png;base64,${qrBuffer.toString("base64")}`;
  } catch {
    // QR image not found — skip
  }

  const pdfBuffer = await renderToBuffer(
    InvoicePDF({
      invoiceNumber: invoice.invoice_number,
      createdAt: invoice.created_at,
      dueDate: invoice.due_date,
      clientName,
      clientEmail: contact?.email,
      clientPhone: contact?.phone,
      clientCompany: contact?.company_name,
      clientGst: invoice.gst_number,
      clientState: null,
      items,
      gst,
      notes: invoice.notes,
      amountInWords: amountInWords(gst.total),
      qrCodeDataUrl,
    })
  );

  // Upload to Supabase Storage
  const fileName = `invoices/${invoice.invoice_number}.pdf`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("documents")
    .upload(fileName, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("PDF upload error:", uploadError.message);
  } else {
    const { data: urlData } = supabaseAdmin.storage
      .from("documents")
      .getPublicUrl(fileName);

    if (urlData?.publicUrl) {
      await supabaseAdmin
        .from("invoices")
        .update({ pdf_url: urlData.publicUrl })
        .eq("id", id);
    }
  }

  // Convert Buffer to Uint8Array for NextResponse compatibility
  const uint8Array = new Uint8Array(pdfBuffer);

  return new NextResponse(uint8Array, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
