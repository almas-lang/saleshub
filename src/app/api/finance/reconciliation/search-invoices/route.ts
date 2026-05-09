export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Search invoices and installments for manual reconciliation linking.
 * Returns invoices matching the search query (by client name, invoice number, or amount).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const amount = searchParams.get("amount");

  // Search invoices by number, client name, or amount
  let query = supabaseAdmin
    .from("invoices")
    .select("id, invoice_number, total, status, paid_at, has_installments, contacts(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(20);

  if (q) {
    query = query.or(
      `invoice_number.ilike.%${q}%,contacts.first_name.ilike.%${q}%,contacts.last_name.ilike.%${q}%`
    );
  }

  // If amount provided, also search by exact amount match
  if (amount) {
    const amt = parseFloat(amount);
    if (!isNaN(amt)) {
      query = query.gte("total", amt - 1).lte("total", amt + 1);
    }
  }

  const { data: invoices } = await query;

  // Also fetch installments for matching
  let instQuery = supabaseAdmin
    .from("installments")
    .select("id, invoice_id, installment_number, amount, status, due_date, paid_at")
    .order("due_date", { ascending: true })
    .limit(30);

  if (amount) {
    const amt = parseFloat(amount);
    if (!isNaN(amt)) {
      instQuery = instQuery.gte("amount", amt - 1).lte("amount", amt + 1);
    }
  }

  const { data: installments } = await instQuery;

  // Enrich installments with invoice numbers
  const invoiceIds = [...new Set((installments ?? []).map((i) => i.invoice_id))];
  let invoiceMap: Record<string, { invoice_number: string; contact_name: string }> = {};

  if (invoiceIds.length > 0) {
    const { data: invs } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, contacts(first_name, last_name)")
      .in("id", invoiceIds);

    for (const inv of invs ?? []) {
      const contact = inv.contacts as { first_name: string; last_name: string | null } | null;
      invoiceMap[inv.id] = {
        invoice_number: inv.invoice_number,
        contact_name: contact ? `${contact.first_name} ${contact.last_name ?? ""}`.trim() : "",
      };
    }
  }

  return NextResponse.json({
    invoices: (invoices ?? []).map((inv) => {
      const contact = inv.contacts as { first_name: string; last_name: string | null } | null;
      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        total: inv.total,
        status: inv.status,
        has_installments: inv.has_installments,
        client_name: contact ? `${contact.first_name} ${contact.last_name ?? ""}`.trim() : "",
      };
    }),
    installments: (installments ?? []).map((inst) => ({
      id: inst.id,
      invoice_id: inst.invoice_id,
      installment_number: inst.installment_number,
      amount: inst.amount,
      status: inst.status,
      due_date: inst.due_date,
      invoice_number: invoiceMap[inst.invoice_id]?.invoice_number ?? "",
      client_name: invoiceMap[inst.invoice_id]?.contact_name ?? "",
    })),
  });
}
