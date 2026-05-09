import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  // Recalculate GST breakup if relevant fields changed
  let gstCgst = body.gst_cgst ?? undefined;
  let gstSgst = body.gst_sgst ?? undefined;
  let gstIgst = body.gst_igst ?? undefined;

  if (body.gst_applicable && body.gst_rate && body.amount) {
    const gstAmount = Math.round(body.amount * (body.gst_rate / 100));
    gstCgst = Math.round(gstAmount / 2);
    gstSgst = gstAmount - gstCgst;
    gstIgst = null;
  } else if (body.gst_applicable === false) {
    gstCgst = null;
    gstSgst = null;
    gstIgst = null;
  }

  // Recalculate TDS if relevant fields changed
  let tdsAmount = body.tds_amount ?? undefined;
  if (body.tds_rate && body.amount) {
    tdsAmount = Math.round(body.amount * (body.tds_rate / 100));
  } else if (body.tds_section === "" || body.tds_section === null) {
    tdsAmount = null;
  }

  const { data, error } = await supabase
    .from("transactions")
    .update({
      ...(body.amount !== undefined && { amount: body.amount }),
      ...(body.category && { category: body.category }),
      ...(body.date && { date: body.date }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.gst_applicable !== undefined && { gst_applicable: body.gst_applicable }),
      ...(body.gst_rate !== undefined && { gst_rate: body.gst_rate ?? null }),
      ...(gstCgst !== undefined && { gst_cgst: gstCgst }),
      ...(gstSgst !== undefined && { gst_sgst: gstSgst }),
      ...(gstIgst !== undefined && { gst_igst: gstIgst }),
      ...(body.vendor_gstin !== undefined && { vendor_gstin: body.vendor_gstin || null }),
      ...(body.payment_mode !== undefined && { payment_mode: body.payment_mode || null }),
      ...(body.receipt_url !== undefined && { receipt_url: body.receipt_url || null }),
      ...(body.attachment_url !== undefined && { attachment_url: body.attachment_url || null }),
      ...(body.tds_section !== undefined && { tds_section: body.tds_section || null }),
      ...(body.tds_rate !== undefined && { tds_rate: body.tds_rate ?? null }),
      ...(tdsAmount !== undefined && { tds_amount: tdsAmount }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from("transactions").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
