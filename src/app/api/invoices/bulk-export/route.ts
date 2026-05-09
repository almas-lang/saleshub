export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import * as archiver from "archiver";
import { renderToBuffer } from "@react-pdf/renderer";
import { readFile } from "fs/promises";
import { join } from "path";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculateGST } from "@/lib/invoices/gst";
import { amountInWords } from "@/lib/invoices/utils";
import { InvoicePDF } from "@/lib/pdf/invoice-template";
import { parseInvoiceItems } from "@/types/invoices";
import { PassThrough } from "stream";

/**
 * POST /api/invoices/bulk-export
 * Body: { invoice_ids: string[] } or { month: "YYYY-MM" } or { status: "paid" }
 * Returns a ZIP file containing all invoice PDFs.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { invoice_ids, month, status } = body as {
    invoice_ids?: string[];
    month?: string;
    status?: string;
  };

  // Build query based on filters
  let query = supabaseAdmin
    .from("invoices")
    .select("*, contacts(id, first_name, last_name, email, phone, company_name)")
    .order("created_at", { ascending: true });

  if (invoice_ids?.length) {
    query = query.in("id", invoice_ids);
  } else if (month) {
    const [y, m] = month.split("-").map(Number);
    const from = new Date(y, m - 1, 1).toISOString();
    const to = new Date(y, m, 1).toISOString();
    query = query.gte("created_at", from).lt("created_at", to);
    if (status) query = query.eq("status", status as "draft" | "sent" | "paid" | "overdue" | "cancelled");
  } else if (status) {
    query = query.eq("status", status as "draft" | "sent" | "paid" | "overdue" | "cancelled");
  } else {
    return NextResponse.json(
      { error: "Provide invoice_ids, month, or status filter" },
      { status: 400 }
    );
  }

  const { data: invoices, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!invoices?.length) {
    return NextResponse.json({ error: "No invoices found" }, { status: 404 });
  }

  // Read QR code once
  let qrCodeDataUrl: string | undefined;
  try {
    const qrPath = join(process.cwd(), "public/images/upi-qr.png");
    const qrBuffer = await readFile(qrPath);
    qrCodeDataUrl = `data:image/png;base64,${qrBuffer.toString("base64")}`;
  } catch {
    // QR not found
  }

  // Create ZIP archive
  const archive = archiver("zip", { zlib: { level: 5 } });
  const passthrough = new PassThrough();
  archive.pipe(passthrough);

  // Generate PDFs and add to archive
  for (const invoice of invoices) {
    const items = parseInvoiceItems(invoice.items);
    const gst = calculateGST(items, null, invoice.gst_rate ?? 18);
    const contact = invoice.contacts as {
      first_name: string;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      company_name: string | null;
    } | null;

    const clientName = contact
      ? `${contact.first_name} ${contact.last_name ?? ""}`.trim()
      : "Unknown";

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

    archive.append(Buffer.from(pdfBuffer), {
      name: `${invoice.invoice_number}.pdf`,
    });
  }

  await archive.finalize();

  // Collect into buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of passthrough) {
    chunks.push(chunk as Uint8Array);
  }
  const zipBuffer = Buffer.concat(chunks);

  const label = month ?? status ?? "invoices";

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="invoices-${label}.zip"`,
    },
  });
}
