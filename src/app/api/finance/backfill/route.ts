import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * One-time backfill: creates income transactions for paid invoices
 * that don't already have matching transactions.
 */
export async function POST(request: NextRequest) {
  // Get all paid invoices
  const { data: invoices, error: invErr } = await supabaseAdmin
    .from("invoices")
    .select("id, invoice_number, total, paid_at, contact_id, payment_gateway")
    .eq("status", "paid")
    .not("paid_at", "is", null);

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 500 });
  }

  if (!invoices || invoices.length === 0) {
    return NextResponse.json({ created: 0, message: "No paid invoices found" });
  }

  // Get existing income transactions linked to invoices
  const { data: existing } = await supabaseAdmin
    .from("transactions")
    .select("invoice_id")
    .eq("type", "income")
    .not("invoice_id", "is", null);

  const existingSet = new Set((existing ?? []).map((t) => t.invoice_id));

  // Filter invoices without transactions
  const missing = invoices.filter((inv) => !existingSet.has(inv.id));

  if (missing.length === 0) {
    return NextResponse.json({
      created: 0,
      message: "All paid invoices already have income transactions",
    });
  }

  // Insert income transactions
  const rows = missing.map((inv) => ({
    type: "income" as const,
    amount: inv.total,
    category: "Invoice Payment",
    date: inv.paid_at!.split("T")[0],
    description: `Payment for ${inv.invoice_number} via ${inv.payment_gateway ?? "unknown"}`,
    invoice_id: inv.id,
    contact_id: inv.contact_id,
  }));

  const { error: insertErr } = await supabaseAdmin
    .from("transactions")
    .insert(rows);

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    created: rows.length,
    message: `Created ${rows.length} income transactions`,
  });
}
