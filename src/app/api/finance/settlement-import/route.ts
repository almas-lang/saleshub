export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Cashfree Settlement Import
 *
 * Cashfree settlement CSVs typically have columns like:
 * Settlement ID, Settlement Date, Order ID, Order Amount, Settlement Amount,
 * Service Charge, Service Tax, Net Amount, UTR, etc.
 *
 * The Order ID maps to our invoice/installment IDs (inv-{uuid} or inst-{uuid}).
 * A single settlement (one bank entry) contains multiple orders.
 *
 * This endpoint:
 * 1. Groups rows by Settlement ID
 * 2. For each order, looks up the matching invoice/installment
 * 3. Creates bank_transaction entries that link the settlement to individual invoices
 * 4. Returns match stats
 */

interface SettlementRow {
  settlement_id: string;
  settlement_date: string;
  order_id: string;
  order_amount: number;
  settlement_amount: number;
  service_charge: number;
  service_tax: number;
  adjustment: number;
  utr: string;
}

export async function POST(request: Request) {
  const supabase = supabaseAdmin;
  const body = await request.json();
  const { rows, month } = body as { rows: SettlementRow[]; month: string };

  if (!rows?.length || !month) {
    return NextResponse.json(
      { error: "rows and month are required" },
      { status: 400 }
    );
  }

  // Group by settlement ID
  const settlementGroups = new Map<string, SettlementRow[]>();
  for (const row of rows) {
    const group = settlementGroups.get(row.settlement_id) ?? [];
    group.push(row);
    settlementGroups.set(row.settlement_id, group);
  }

  let matchedCount = 0;
  let unmatchedCount = 0;
  const results: {
    settlement_id: string;
    total_amount: number;
    orders: { order_id: string; amount: number; matched: boolean; invoice_number?: string }[];
    utr: string;
  }[] = [];

  for (const [settlementId, settlementRows] of settlementGroups) {
    const orders: typeof results[0]["orders"] = [];
    const totalAmount = settlementRows.reduce((s, r) => s + r.settlement_amount, 0);
    const utr = settlementRows[0]?.utr ?? "";

    for (const row of settlementRows) {
      const orderId = row.order_id;
      let matched = false;
      let invoiceNumber: string | undefined;

      // Try to extract UUID from order ID patterns:
      // inv-{uuid}-{timestamp} or inst-{uuid}-{timestamp}
      // Also handles Cashfree-generated IDs like CFPay_... (fallback to amount matching)
      const invMatch = orderId.match(/^inv-([0-9a-f-]{36})/);
      const instMatch = orderId.match(/^inst-([0-9a-f-]{36})/);

      if (invMatch) {
        const invoiceId = invMatch[1];
        const { data: invoice } = await supabase
          .from("invoices")
          .select("id, invoice_number, total")
          .eq("id", invoiceId)
          .single();

        if (invoice) {
          matched = true;
          invoiceNumber = invoice.invoice_number;

          // Create a reconciliation entry linking this settlement order to the invoice
          await supabase.from("bank_transactions").insert({
            date: row.settlement_date,
            description: `Cashfree Settlement ${settlementId} - ${invoice.invoice_number}`,
            debit: 0,
            credit: row.settlement_amount,
            balance: null,
            reference: utr,
            bank_name: "Cashfree",
            month,
            reconciled: true,
            matched_type: "invoice",
            matched_id: invoice.id,
          });
        }
      } else if (instMatch) {
        const instId = instMatch[1];
        const { data: installment } = await supabase
          .from("installments")
          .select("id, invoice_id, amount, installment_number")
          .eq("id", instId)
          .single();

        if (installment) {
          // Get invoice number for display
          const { data: invoice } = await supabase
            .from("invoices")
            .select("invoice_number")
            .eq("id", installment.invoice_id)
            .single();

          matched = true;
          invoiceNumber = invoice
            ? `${invoice.invoice_number} #${installment.installment_number}`
            : undefined;

          await supabase.from("bank_transactions").insert({
            date: row.settlement_date,
            description: `Cashfree Settlement ${settlementId} - Installment #${installment.installment_number}`,
            debit: 0,
            credit: row.settlement_amount,
            balance: null,
            reference: utr,
            bank_name: "Cashfree",
            month,
            reconciled: true,
            matched_type: "invoice",
            matched_id: installment.invoice_id,
          });
        }
      }

      // Fallback: match by amount against paid invoices/installments in the month
      if (!matched) {
        const { data: amtInvoice } = await supabase
          .from("invoices")
          .select("id, invoice_number, total")
          .eq("status", "paid")
          .gte("paid_at", `${month}-01T00:00:00`)
          .lte("paid_at", `${month}-31T23:59:59`)
          .gte("total", row.order_amount - 1)
          .lte("total", row.order_amount + 1)
          .limit(1)
          .single();

        if (amtInvoice) {
          matched = true;
          invoiceNumber = amtInvoice.invoice_number;

          await supabase.from("bank_transactions").insert({
            date: row.settlement_date,
            description: `Cashfree ${settlementId} - ${amtInvoice.invoice_number} (amount match)`,
            debit: 0,
            credit: row.settlement_amount,
            reference: utr,
            bank_name: "Cashfree",
            month,
            reconciled: true,
            matched_type: "invoice",
            matched_id: amtInvoice.id,
          });
        }
      }

      // Fallback: match by amount against installments
      if (!matched) {
        const { data: amtInst } = await supabase
          .from("installments")
          .select("id, invoice_id, amount, installment_number")
          .eq("status", "paid")
          .gte("amount", row.order_amount - 1)
          .lte("amount", row.order_amount + 1)
          .limit(1)
          .single();

        if (amtInst) {
          const { data: inv } = await supabase
            .from("invoices")
            .select("invoice_number")
            .eq("id", amtInst.invoice_id)
            .single();

          matched = true;
          invoiceNumber = inv ? `${inv.invoice_number} #${amtInst.installment_number}` : undefined;

          await supabase.from("bank_transactions").insert({
            date: row.settlement_date,
            description: `Cashfree ${settlementId} - Installment (amount match)`,
            debit: 0,
            credit: row.settlement_amount,
            reference: utr,
            bank_name: "Cashfree",
            month,
            reconciled: true,
            matched_type: "invoice",
            matched_id: amtInst.invoice_id,
          });
        }
      }

      if (!matched) {
        // Insert unmatched settlement row
        await supabase.from("bank_transactions").insert({
          date: row.settlement_date,
          description: `Cashfree Settlement ${settlementId} - Order ${orderId}`,
          debit: 0,
          credit: row.settlement_amount,
          balance: null,
          reference: utr,
          bank_name: "Cashfree",
          month,
          reconciled: false,
        });
        unmatchedCount++;
      } else {
        matchedCount++;
      }

      orders.push({
        order_id: orderId,
        amount: row.settlement_amount,
        matched,
        invoice_number: invoiceNumber,
      });
    }

    // Also record the service charges as expenses
    const totalFees = settlementRows.reduce((s, r) => s + r.service_charge + r.service_tax, 0);
    if (totalFees > 0) {
      await supabase.from("transactions").insert({
        type: "expense",
        amount: totalFees,
        category: "Software & Tools",
        date: settlementRows[0].settlement_date,
        description: `Cashfree fees - Settlement ${settlementId}`,
        gst_applicable: true,
        gst_rate: 18,
        payment_mode: "Auto-deducted",
      });
    }

    results.push({
      settlement_id: settlementId,
      total_amount: totalAmount,
      orders,
      utr,
    });
  }

  return NextResponse.json({
    settlements: results.length,
    orders: rows.length,
    matched: matchedCount,
    unmatched: unmatchedCount,
    fees_logged: results.length,
    details: results,
  });
}
