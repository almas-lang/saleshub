export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = supabaseAdmin;
  const body = await request.json();

  const {
    month,
    bank_rows,
    cashfree_rows,
    settlement_rows,
    card_rows,
  } = body as {
    month: string;
    bank_rows?: { date: string; description: string; debit: number; credit: number; balance?: number; reference?: string }[];
    cashfree_rows?: { settlement_id: string; settlement_date: string; order_id: string; order_amount: number; settlement_amount: number; service_charge: number; service_tax: number; adjustment: number; utr: string; customer_name?: string; customer_phone?: string; customer_email?: string }[];
    settlement_rows?: { settlement_id: string; settlement_date: string; order_id: string; order_amount: number; settlement_amount: number; service_charge: number; service_tax: number; adjustment: number; utr: string }[];
    card_rows?: { date: string; description: string; amount: number; type: "debit" | "credit"; reference?: string }[];
  };

  if (!month) {
    return NextResponse.json({ error: "month is required" }, { status: 400 });
  }

  const [yearStr, monStr] = month.split("-");
  const from = `${month}-01`;
  const lastDay = new Date(parseInt(yearStr), parseInt(monStr), 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;

  // Settlement rows are reference data only — don't count them as transactions
  const totalCount = (bank_rows?.length ?? 0) + (cashfree_rows?.length ?? 0) + (card_rows?.length ?? 0);
  const { data: batch, error: batchError } = await supabase
    .from("reconciliation_batches")
    .insert({ month: monStr, year: parseInt(yearStr), status: "in_progress", total_count: totalCount })
    .select().single();

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message ?? "Failed to create batch" }, { status: 500 });
  }

  const batchId = batch.id;
  let matchedCount = 0;

  // Step 1: Cashfree Transaction Report
  if (cashfree_rows?.length) {
    for (const row of cashfree_rows) {
      let matched = false;
      let matchedId: string | null = null;
      const invMatch = row.order_id.match(/^inv-([0-9a-f-]{36})/);
      const instMatch = row.order_id.match(/^inst-([0-9a-f-]{36})/);

      if (invMatch) {
        const { data: inv } = await supabase.from("invoices").select("id").eq("id", invMatch[1]).single();
        if (inv) { matched = true; matchedId = inv.id; }
      } else if (instMatch) {
        const { data: inst } = await supabase.from("installments").select("id, invoice_id").eq("id", instMatch[1]).single();
        if (inst) { matched = true; matchedId = inst.invoice_id; }
      }
      if (!matched) {
        const { data: inv } = await supabase.from("invoices").select("id").eq("status", "paid")
          .gte("total", row.order_amount - 1).lte("total", row.order_amount + 1).limit(1).single();
        if (inv) { matched = true; matchedId = inv.id; }
      }

      // Build a readable description with customer info
      const custName = row.customer_name && row.customer_name !== "N/A" ? row.customer_name : "";
      const custPhone = row.customer_phone?.replace(/^\+91/, "") ?? "";
      const custEmail = row.customer_email && row.customer_email !== "N/A" ? row.customer_email : "";
      const descParts = [custName, custEmail, custPhone].filter(Boolean);
      const desc = descParts.length > 0
        ? `${custName || "Customer"} · ${descParts.slice(1).join(" · ")}`
        : `Cashfree: ${row.order_id}`;

      await supabase.from("bank_transactions").insert({
        date: row.settlement_date, description: desc,
        debit: 0,
        credit: row.order_amount,
        balance: row.settlement_amount,
        reference: row.utr,
        bank_name: "Cashfree", month, batch_id: batchId,
        reconciled: matched, matched_type: matched ? "invoice" : null, matched_id: matchedId,
      });
      if (matched) matchedCount++;
    }
    const totalFees = cashfree_rows.reduce((s, r) => s + r.service_charge + r.service_tax, 0);
    if (totalFees > 0) {
      await supabase.from("transactions").insert({
        type: "expense", amount: totalFees, category: "Software & Tools",
        date: cashfree_rows[0].settlement_date, description: `Cashfree PG fees - ${month}`,
        gst_applicable: true, gst_rate: 18, payment_mode: "Auto-deducted",
      });
    }
  }

  // Step 2: Settlement Report — store as reference data only, NOT as bank_transactions.
  // Settlement UTRs are used in Step 4 to match bank statement entries.
  // We don't create separate rows to avoid double-counting with transaction report entries.
  const settlementUTRs = new Map<string, number>(); // UTR → settlement amount
  if (settlement_rows?.length) {
    for (const row of settlement_rows) {
      if (row.utr) {
        settlementUTRs.set(row.utr, (settlementUTRs.get(row.utr) ?? 0) + row.settlement_amount);
      }
    }
  }

  // Step 3: Credit Card Statement
  if (card_rows?.length) {
    const { data: expenses } = await supabase.from("transactions")
      .select("id, amount, date, description, category, payment_mode")
      .eq("type", "expense").gte("date", `${month}-01`).lte("date", to);
    const matchedExpenseIds = new Set<string>();

    for (const row of card_rows) {
      if (row.type === "credit") {
        // CC bill payment (Cr on card = you paid your card bill) — this is a SPEND, not earning.
        // Store as debit since money is leaving your account to pay the card.
        await supabase.from("bank_transactions").insert({
          date: row.date, description: `CC Bill Payment: ${row.description}`,
          debit: row.amount, credit: 0, bank_name: "HDFC Credit Card",
          month, batch_id: batchId, reconciled: true, matched_type: "credit_card_payment",
        });
        matchedCount++;
        continue;
      }
      const rowDate = new Date(row.date + "T00:00:00");
      let matched = false;
      for (const exp of expenses ?? []) {
        if (matchedExpenseIds.has(exp.id) || Math.abs(exp.amount - row.amount) >= 1) continue;
        const dayDiff = Math.abs((rowDate.getTime() - new Date(exp.date + "T00:00:00").getTime()) / 86400000);
        if (dayDiff <= 5) {
          matched = true; matchedExpenseIds.add(exp.id);
          await supabase.from("bank_transactions").insert({
            date: row.date, description: `CC: ${row.description}`, debit: row.amount, credit: 0,
            bank_name: "HDFC Credit Card", month, batch_id: batchId,
            reconciled: true, matched_type: "expense", matched_id: exp.id,
          });
          await supabase.from("transactions").update({ payment_mode: "Credit Card" }).eq("id", exp.id);
          matchedCount++; break;
        }
      }
      if (!matched) {
        await supabase.from("bank_transactions").insert({
          date: row.date, description: `CC: ${row.description}`, debit: row.amount, credit: 0,
          bank_name: "HDFC Credit Card", month, batch_id: batchId, reconciled: false,
        });
      }
    }
  }

  // Step 4: Bank Statement
  if (bank_rows?.length) {
    const bankTxns = bank_rows.map((r) => ({
      date: r.date, description: r.description, debit: r.debit || 0, credit: r.credit || 0,
      balance: r.balance ?? null, reference: r.reference ?? null, month, batch_id: batchId,
    }));
    const { data: insertedBank } = await supabase.from("bank_transactions").insert(bankTxns).select();

    const [invoicesRes, expensesRes, salariesRes, cfRes] = await Promise.all([
      supabase.from("invoices").select("id, total, paid_at, invoice_number").eq("status", "paid")
        .gte("paid_at", `${from}T00:00:00`).lte("paid_at", `${to}T23:59:59`),
      supabase.from("transactions").select("id, amount, date, description").eq("type", "expense")
        .gte("date", from).lte("date", to),
      supabase.from("salary_payments").select("id, amount, paid_date").gte("paid_date", from).lte("paid_date", to),
      // Fetch Cashfree transaction report entries (from this batch) for UTR-based matching
      // Fetch Cashfree entries — credit = order amount, balance = settlement amount
      supabase.from("bank_transactions").select("id, reference, credit, balance, matched_id")
        .eq("bank_name", "Cashfree").eq("batch_id", batchId).eq("reconciled", true).not("reference", "is", null),
    ]);

    // Build UTR → amount map from BOTH Cashfree transaction entries AND settlement report reference data
    const cfByUTR = new Map<string, number>();
    const cfMatchByUTR = new Map<string, string | null>();

    // From Cashfree transaction report entries (Step 1)
    // Use balance field (settlement amount) for bank matching, since bank receives settlement not order amount
    for (const e of cfRes.data ?? []) {
      if (!e.reference) continue;
      const settlementAmt = e.balance ?? e.credit; // balance = settlement amount, credit = order amount
      cfByUTR.set(e.reference, (cfByUTR.get(e.reference) ?? 0) + settlementAmt);
      if (e.matched_id && !cfMatchByUTR.has(e.reference)) cfMatchByUTR.set(e.reference, e.matched_id);
    }

    // Merge settlement report UTRs (Step 2 reference data) — use settlement amounts which
    // reflect what actually hits the bank (after Cashfree fee deductions)
    for (const [utr, amount] of settlementUTRs) {
      if (!cfByUTR.has(utr)) {
        // Settlement-only UTR (no matching transaction report entry)
        cfByUTR.set(utr, amount);
      }
      // If both exist, prefer settlement amount since that's what the bank sees
      cfByUTR.set(utr, amount);
    }

    const usedInv = new Set<string>(), usedExp = new Set<string>(), usedSal = new Set<string>();

    for (const txn of insertedBank ?? []) {
      let matched = false, matchType = "", matchId = "";

      // UTR-based match against Cashfree data
      if (txn.credit > 0) {
        const ref = txn.reference?.trim() ?? "";
        const desc = txn.description ?? "";

        // Try matching by UTR in reference field, in description, or by amount
        for (const [utr, total] of cfByUTR) {
          const utrMatch = (ref && ref === utr) || desc.includes(utr);
          const amountMatch = Math.abs(txn.credit - total) < 2;
          if (utrMatch || amountMatch) {
            matchType = "cashfree_settlement";
            matchId = cfMatchByUTR.get(utr) ?? "";
            matched = true;
            cfByUTR.delete(utr); // Don't match this UTR again
            break;
          }
        }

        // Direct invoice amount match (for UPI payments not through Cashfree)
        if (!matched) {
          const inv = (invoicesRes.data ?? []).find((i) => !usedInv.has(i.id) && Math.abs(i.total - txn.credit) < 1);
          if (inv) { matchType = "invoice"; matchId = inv.id; usedInv.add(inv.id); matched = true; }
        }
      }

      // CC bill payment
      if (!matched && txn.debit > 0 && (txn.description ?? "").toLowerCase().includes("credit card")) {
        const { data: cp } = await supabase.from("bank_transactions").select("id, credit")
          .eq("bank_name", "HDFC Credit Card").gt("credit", 0).eq("batch_id", batchId);
        const match = (cp ?? []).find((c) => Math.abs(c.credit - txn.debit) < 2);
        if (match) { matchType = "credit_card_payment"; matchId = match.id; matched = true; }
      }

      // Expense
      if (!matched && txn.debit > 0) {
        const exp = (expensesRes.data ?? []).find((e) => !usedExp.has(e.id) && Math.abs(e.amount - txn.debit) < 1);
        if (exp) { matchType = "expense"; matchId = exp.id; usedExp.add(exp.id); matched = true; }
      }

      // Salary
      if (!matched && txn.debit > 0) {
        const sal = (salariesRes.data ?? []).find((s) => !usedSal.has(s.id) && Math.abs(s.amount - txn.debit) < 1);
        if (sal) { matchType = "salary"; matchId = sal.id; usedSal.add(sal.id); matched = true; }
      }

      if (matched) {
        await supabase.from("bank_transactions").update({ reconciled: true, matched_type: matchType, matched_id: matchId || null }).eq("id", txn.id);
        matchedCount++;
      }
    }
  }

  await supabase.from("reconciliation_batches").update({
    status: "completed", matched_count: matchedCount, unmatched_count: totalCount - matchedCount,
  }).eq("id", batchId);

  return NextResponse.json({ batch_id: batchId, total: totalCount, matched: matchedCount, unmatched: totalCount - matchedCount });
}
