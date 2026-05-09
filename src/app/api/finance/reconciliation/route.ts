export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET — List reconciliation batches
 * POST — Upload bank CSV and create a new batch with auto-matching
 */

export async function GET() {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("reconciliation_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = supabaseAdmin;
  const body = await request.json();
  const { month, rows, file_url } = body as {
    month: string; // YYYY-MM
    file_url?: string | null;
    rows: {
      date: string;
      description: string;
      debit: number;
      credit: number;
      balance?: number;
      reference?: string;
    }[];
  };

  if (!month || !rows?.length) {
    return NextResponse.json(
      { error: "month and rows are required" },
      { status: 400 }
    );
  }

  const [yearStr, monStr] = month.split("-");

  // Create batch
  const { data: batch, error: batchError } = await supabase
    .from("reconciliation_batches")
    .insert({
      month: monStr,
      year: parseInt(yearStr),
      status: "in_progress",
      total_count: rows.length,
      file_url: file_url ?? null,
    })
    .select()
    .single();

  if (batchError || !batch) {
    return NextResponse.json(
      { error: batchError?.message ?? "Failed to create batch" },
      { status: 500 }
    );
  }

  // Insert bank transactions
  const bankTxns = rows.map((r) => ({
    date: r.date,
    description: r.description,
    debit: r.debit || 0,
    credit: r.credit || 0,
    balance: r.balance ?? null,
    reference: r.reference ?? null,
    month,
    batch_id: batch.id,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("bank_transactions")
    .insert(bankTxns)
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // ── Auto-match engine ──
  // Fetch all potential matches for the month
  const from = `${month}-01`;
  const lastDay = new Date(parseInt(yearStr), parseInt(monStr), 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;

  const [invoicesRes, expensesRes, salariesRes, cashfreeEntriesRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, total, paid_at, invoice_number")
      .eq("status", "paid")
      .gte("paid_at", `${from}T00:00:00`)
      .lte("paid_at", `${to}T23:59:59`),
    supabase
      .from("transactions")
      .select("id, amount, date, description, category")
      .eq("type", "expense")
      .gte("date", from)
      .lte("date", to),
    supabase
      .from("salary_payments")
      .select("id, amount, paid_date, employee_name")
      .gte("paid_date", from)
      .lte("paid_date", to),
    // Fetch previously imported Cashfree entries for UTR-based matching
    supabase
      .from("bank_transactions")
      .select("id, reference, credit, matched_type, matched_id, description")
      .eq("bank_name", "Cashfree")
      .eq("reconciled", true)
      .not("reference", "is", null),
  ]);

  const invoices = invoicesRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const salaries = salariesRes.data ?? [];
  const cashfreeEntries = cashfreeEntriesRes.data ?? [];

  // Build UTR → Cashfree entries map (one UTR/settlement can have multiple orders)
  const cashfreeByUTR = new Map<string, typeof cashfreeEntries>();
  for (const entry of cashfreeEntries) {
    if (!entry.reference) continue;
    const utr = entry.reference.trim();
    const group = cashfreeByUTR.get(utr) ?? [];
    group.push(entry);
    cashfreeByUTR.set(utr, group);
  }

  // Also build UTR → total settlement amount
  const settlementAmountByUTR = new Map<string, number>();
  for (const [utr, entries] of cashfreeByUTR) {
    settlementAmountByUTR.set(utr, entries.reduce((s, e) => s + e.credit, 0));
  }

  let matchedCount = 0;
  const updates: { id: string; matched_type: string; matched_id: string }[] = [];

  // Track which entities have already been matched
  const matchedInvoiceIds = new Set<string>();
  const matchedExpenseIds = new Set<string>();
  const matchedSalaryIds = new Set<string>();

  for (const txn of inserted ?? []) {
    let matched = false;

    // ── 1. UTR-based matching against Cashfree data ──
    // Bank statement entries for Cashfree settlements contain UTR in the description
    // or reference field. Match against previously imported Cashfree entries.
    if (txn.credit > 0 && !matched) {
      // Extract potential UTR from description or reference
      // Bank descriptions often look like: "A2AINT01 - C... - CF PG SETTLEMENT ID 299148297 - 50200..."
      // Or reference field might have the UTR directly
      const txnRef = txn.reference?.trim() ?? "";
      const txnDesc = txn.description ?? "";

      // Try matching by UTR in reference field
      if (txnRef && cashfreeByUTR.has(txnRef)) {
        const cfEntries = cashfreeByUTR.get(txnRef)!;
        const settlementTotal = settlementAmountByUTR.get(txnRef) ?? 0;

        // Check if bank amount matches the settlement total (within ₹2 tolerance for rounding)
        if (Math.abs(txn.credit - settlementTotal) < 2) {
          // Link to the first invoice in this settlement group
          const invoiceEntry = cfEntries.find((e) => e.matched_id);
          updates.push({
            id: txn.id,
            matched_type: "cashfree_settlement",
            matched_id: invoiceEntry?.matched_id ?? cfEntries[0].id,
          });
          matched = true;
        }
      }

      // Try matching by UTR found in description text
      if (!matched) {
        for (const [utr, cfEntries] of cashfreeByUTR) {
          if (txnDesc.includes(utr)) {
            const settlementTotal = settlementAmountByUTR.get(utr) ?? 0;
            if (Math.abs(txn.credit - settlementTotal) < 2) {
              const invoiceEntry = cfEntries.find((e) => e.matched_id);
              updates.push({
                id: txn.id,
                matched_type: "cashfree_settlement",
                matched_id: invoiceEntry?.matched_id ?? cfEntries[0].id,
              });
              matched = true;
              break;
            }
          }
        }
      }

      // Try matching by settlement amount against Cashfree data
      if (!matched) {
        for (const [utr, total] of settlementAmountByUTR) {
          if (Math.abs(txn.credit - total) < 2) {
            const cfEntries = cashfreeByUTR.get(utr)!;
            const invoiceEntry = cfEntries.find((e) => e.matched_id);
            updates.push({
              id: txn.id,
              matched_type: "cashfree_settlement",
              matched_id: invoiceEntry?.matched_id ?? cfEntries[0].id,
            });
            matched = true;
            break;
          }
        }
      }
    }

    // ── 2. Direct invoice amount matching (for UPI/direct payments) ──
    if (!matched && txn.credit > 0) {
      const inv = invoices.find(
        (i) => !matchedInvoiceIds.has(i.id) && Math.abs(i.total - txn.credit) < 1
      );
      if (inv) {
        updates.push({ id: txn.id, matched_type: "invoice", matched_id: inv.id });
        matchedInvoiceIds.add(inv.id);
        matched = true;
      }
    }

    // ── 3. Match credit card bill payments ──
    // Bank debits for "CREDIT CARD" should match against previously imported card statement totals
    if (!matched && txn.debit > 0) {
      const desc = (txn.description ?? "").toLowerCase();
      if (desc.includes("credit card") || desc.includes("cc payment") || desc.includes("hdfc card")) {
        // Find card statement entries (bank_transactions from "HDFC Credit Card") for similar amount
        const { data: cardEntries } = await supabase
          .from("bank_transactions")
          .select("id, credit")
          .eq("bank_name", "HDFC Credit Card")
          .gt("credit", 0);

        // The card statement has a "Cr" payment entry matching this bank debit
        const cardPayment = (cardEntries ?? []).find(
          (c) => Math.abs(c.credit - txn.debit) < 2
        );
        if (cardPayment) {
          updates.push({ id: txn.id, matched_type: "credit_card_payment", matched_id: cardPayment.id });
          matched = true;
        }
      }
    }

    // ── 4. Match debits against logged expenses ──
    if (!matched && txn.debit > 0) {
      const exp = expenses.find(
        (e) => !matchedExpenseIds.has(e.id) && Math.abs(e.amount - txn.debit) < 1
      );
      if (exp) {
        updates.push({ id: txn.id, matched_type: "expense", matched_id: exp.id });
        matchedExpenseIds.add(exp.id);
        matched = true;
      }
    }

    // ── 4. Match debits against salaries ──
    if (!matched && txn.debit > 0) {
      const sal = salaries.find(
        (s) => !matchedSalaryIds.has(s.id) && Math.abs(s.amount - txn.debit) < 1
      );
      if (sal) {
        updates.push({ id: txn.id, matched_type: "salary", matched_id: sal.id });
        matchedSalaryIds.add(sal.id);
        matched = true;
      }
    }

    if (matched) matchedCount++;
  }

  // Apply matches
  for (const u of updates) {
    await supabase
      .from("bank_transactions")
      .update({
        reconciled: true,
        matched_type: u.matched_type,
        matched_id: u.matched_id,
      })
      .eq("id", u.id);
  }

  // Update batch
  await supabase
    .from("reconciliation_batches")
    .update({
      status: "completed",
      matched_count: matchedCount,
      unmatched_count: rows.length - matchedCount,
    })
    .eq("id", batch.id);

  return NextResponse.json({
    batch_id: batch.id,
    total: rows.length,
    matched: matchedCount,
    unmatched: rows.length - matchedCount,
  });
}
