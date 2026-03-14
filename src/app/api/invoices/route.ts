import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { invoiceSchema } from "@/lib/validations";
import { getNextInvoiceNumber } from "@/lib/invoices/utils";
import { calculateGST } from "@/lib/invoices/gst";
import type { InvoiceLineItem } from "@/types/invoices";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const params = request.nextUrl.searchParams;

  const page = Math.max(1, parseInt(params.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(params.get("per_page") ?? "25")));
  const status = params.get("status") ?? "";
  const search = params.get("search")?.trim() ?? "";
  const sort = params.get("sort") ?? "created_at";
  const order = params.get("order") ?? "desc";
  const contactId = params.get("contact_id") ?? "";

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("invoices")
    .select(
      "*, contacts(id, first_name, last_name, email, phone, company_name)",
      { count: "exact" }
    );

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (contactId) {
    query = query.eq("contact_id", contactId);
  }

  if (search) {
    query = query.ilike("invoice_number", `%${search}%`);
  }

  const ascending = order === "asc";
  query = query.order(sort, { ascending }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((count ?? 0) / perPage),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json();
  const parsed = invoiceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { customer_state, ...values } = parsed.data;
  const items = values.items as InvoiceLineItem[];

  // Calculate GST
  const gst = calculateGST(items, customer_state, values.gst_rate);

  // Generate invoice number
  const invoiceNumber = await getNextInvoiceNumber("invoice");

  const cleaned: Record<string, unknown> = {
    contact_id: values.contact_id,
    invoice_number: invoiceNumber,
    items: JSON.stringify(items),
    subtotal: gst.subtotal,
    total: gst.total,
    gst_rate: gst.gstRate,
    gst_amount: gst.isIntraState ? gst.cgst + gst.sgst : gst.igst,
    gst_number: values.gst_number || null,
    due_date: values.due_date || null,
    notes: values.notes || null,
    type: values.type ?? "invoice",
    status: values.status ?? "draft",
    is_recurring: values.is_recurring ?? false,
    recurrence_day: values.recurrence_day ?? null,
  };

  const { data, error } = await supabase
    .from("invoices")
    .insert(cleaned)
    .select("*, contacts(id, first_name, last_name, email, phone, company_name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
