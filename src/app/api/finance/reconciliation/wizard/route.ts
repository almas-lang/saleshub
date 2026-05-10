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
    cashfree_rows?: { settlement_id: string; settlement_date: string; order_id: string; order_amount: number; settlement_amount: number; service_charge: number; service_tax: number; adjustment: number; utr: string; customer_name?: string; customer_phone?: string; customer_email?: string; payment_mode?: string }[];
    settlement_rows?: { settlement_id: string; settlement_date: string; order_id: string; order_amount: number; settlement_amount: number; service_charge: number; service_tax: number; adjustment: number; utr: string; net_settlement_amount?: number }[];
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

      // Build a readable description with customer info + payment mode
      const custName = row.customer_name && row.customer_name !== "N/A" ? row.customer_name : "";
      const custPhone = row.customer_phone?.replace(/^\+91/, "") ?? "";
      const custEmail = row.customer_email && row.customer_email !== "N/A" ? row.customer_email : "";
      const pMode = row.payment_mode ?? "";
      const modeShort = pMode.includes("CREDIT_CARD") ? "Card" : pMode.includes("UPI") ? "UPI" : pMode.includes("DEBIT_CARD") ? "Debit" : pMode.includes("NET_BANKING") ? "NetBanking" : "";
      const infoParts = [custEmail, custPhone, modeShort].filter(Boolean);
      const desc = custName
        ? `${custName}${infoParts.length > 0 ? " · " + infoParts.join(" · ") : ""}`
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
      // Only create fee entry if one doesn't already exist for this month
      const { data: existingFee } = await supabase.from("transactions")
        .select("id").eq("type", "expense")
        .ilike("description", `%Cashfree PG fees%${month}%`)
        .limit(1).single();

      if (!existingFee) {
        await supabase.from("transactions").insert({
          type: "expense", amount: totalFees, category: "Software & Tools",
          date: cashfree_rows[0].settlement_date, description: `Cashfree PG fees - ${month}`,
          gst_applicable: true, gst_rate: 18, payment_mode: "Auto-deducted",
        });
      }
    }
  }

  // Step 2: Settlement Report — store as reference data only, NOT as bank_transactions.
  // Settlement UTRs are used in Step 4 to match bank statement entries.
  // We don't create separate rows to avoid double-counting with transaction report entries.
  // Use net_settlement_amount (after adjustments) — this is what actually hits the bank.
  // E.g., settlement ₹23,446 with adjustment -₹15,062 → net ₹8,384 is what bank receives.
  const settlementUTRs = new Map<string, number>(); // UTR → net amount that hits bank
  if (settlement_rows?.length) {
    for (const row of settlement_rows) {
      if (row.utr) {
        const netAmount = row.net_settlement_amount ?? (row.settlement_amount + (row.adjustment ?? 0));
        settlementUTRs.set(row.utr, netAmount);
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
  // Key principle: bank credits that match Cashfree UTRs are NOT separate entries.
  // They just confirm the Cashfree payment was received. We skip inserting them entirely
  // and instead mark the Cashfree row as bank-confirmed.
  if (bank_rows?.length) {
    // Fetch data for matching
    const [invoicesRes, installmentsRes, expensesRes, salariesRes, cfRes] = await Promise.all([
      supabase.from("invoices").select("id, total, paid_at, invoice_number").eq("status", "paid")
        .gte("paid_at", `${from}T00:00:00`).lte("paid_at", `${to}T23:59:59`),
      supabase.from("installments").select("id, invoice_id, amount, paid_at, installment_number")
        .eq("status", "paid").gte("paid_at", `${from}T00:00:00`).lte("paid_at", `${to}T23:59:59`),
      supabase.from("transactions").select("id, amount, date, description").eq("type", "expense")
        .gte("date", from).lte("date", to),
      supabase.from("salary_payments").select("id, amount, paid_date").gte("paid_date", from).lte("paid_date", to),
      supabase.from("bank_transactions").select("id, reference, credit, balance, matched_id")
        .eq("bank_name", "Cashfree").eq("batch_id", batchId).not("reference", "is", null),
    ]);

    // Build UTR → settlement amount map for matching bank credits
    const cfByUTR = new Map<string, { settlementAmount: number; cfRowId: string; matchedId: string | null }>();
    for (const e of cfRes.data ?? []) {
      if (!e.reference) continue;
      const settlementAmt = e.balance ?? e.credit;
      const existing = cfByUTR.get(e.reference);
      cfByUTR.set(e.reference, {
        settlementAmount: (existing?.settlementAmount ?? 0) + settlementAmt,
        cfRowId: e.id,
        matchedId: existing?.matchedId ?? e.matched_id,
      });
    }
    // Merge settlement report UTRs
    for (const [utr, amount] of settlementUTRs) {
      const existing = cfByUTR.get(utr);
      if (existing) {
        existing.settlementAmount = amount; // Prefer settlement report amount
      } else {
        cfByUTR.set(utr, { settlementAmount: amount, cfRowId: "", matchedId: null });
      }
    }

    // Also build total CC bill payment amount from card statement for matching
    const ccBillTotal = (card_rows ?? []).filter((r) => r.type === "credit").reduce((s, r) => s + r.amount, 0);

    const usedInv = new Set<string>(), usedInst = new Set<string>(), usedExp = new Set<string>(), usedSal = new Set<string>();
    const installments = installmentsRes.data ?? [];

    for (const row of bank_rows) {
      const desc = row.description ?? "";
      const descLower = desc.toLowerCase();

      // ── CREDITS (money in) ──
      if (row.credit > 0) {
        // 1. Is this a Cashfree settlement hitting the bank?
        //    Match by: UTR in reference/description, or "CASHFREE" in description + amount match
        let isCashfreeSettlement = false;
        const ref = row.reference?.trim() ?? "";

        // Check UTR match
        for (const [utr, cfData] of cfByUTR) {
          const utrMatch = (ref && ref === utr) || desc.includes(utr);
          const amountMatch = Math.abs(row.credit - cfData.settlementAmount) < 2;
          const isCashfreeDesc = descLower.includes("cashfree") || descLower.includes("cf pg settlement");

          if (utrMatch || (amountMatch && isCashfreeDesc) || amountMatch) {
            // This bank credit is just the settlement of an already-recorded Cashfree payment.
            // DON'T insert a new row — just mark the Cashfree row as bank-confirmed.
            if (cfData.cfRowId) {
              await supabase.from("bank_transactions").update({ reconciled: true }).eq("id", cfData.cfRowId);
            }
            cfByUTR.delete(utr);
            isCashfreeSettlement = true;
            matchedCount++;
            break;
          }
        }

        // Fallback: if description contains Cashfree keywords but didn't match any UTR,
        // still skip it (it's a Cashfree settlement with adjustment we can't match exactly)
        if (!isCashfreeSettlement && (descLower.includes("cashfree") || descLower.includes("cf pg settlement"))) {
          // This is a Cashfree settlement we couldn't match by UTR/amount.
          // Don't insert as a separate row — just count it as matched.
          isCashfreeSettlement = true;
          matchedCount++;
        }

        if (isCashfreeSettlement) continue; // Skip — already handled via Cashfree row

        // 2. Direct UPI payment — match against invoice totals
        let matched = false, matchType = "", matchId = "";
        const inv = (invoicesRes.data ?? []).find((i) => !usedInv.has(i.id) && Math.abs(i.total - row.credit) < 1);
        if (inv) { matchType = "invoice"; matchId = inv.id; usedInv.add(inv.id); matched = true; }

        // 3. Match against installment amounts — also check date proximity to avoid wrong matches
        //    (e.g., Hari ₹30k vs Booja ₹30k — same amount, different dates)
        if (!matched) {
          const bankDate = new Date(row.date + "T00:00:00").getTime();
          const inst = installments
            .filter((i) => !usedInst.has(i.id) && Math.abs(Number(i.amount) - row.credit) < 1)
            .sort((a, b) => {
              // Prefer the installment whose paid_at is closest to the bank date
              const da = a.paid_at ? Math.abs(new Date(a.paid_at).getTime() - bankDate) : Infinity;
              const db = b.paid_at ? Math.abs(new Date(b.paid_at).getTime() - bankDate) : Infinity;
              return da - db;
            })[0];
          if (inst) {
            // Only match if paid_at is within 5 days of bank date
            const instDate = inst.paid_at ? new Date(inst.paid_at).getTime() : 0;
            const dayDiff = Math.abs((instDate - bankDate) / 86400000);
            if (dayDiff <= 5) {
              matchType = "invoice"; matchId = inst.invoice_id; usedInst.add(inst.id); matched = true;
            }
          }
        }

        // Insert as a bank row — keep full original description for reference
        await supabase.from("bank_transactions").insert({
          date: row.date, description: desc, debit: 0, credit: row.credit,
          balance: row.balance ?? null, reference: row.reference ?? null,
          month, batch_id: batchId,
          reconciled: matched, matched_type: matched ? matchType : null, matched_id: matched ? matchId : null,
        });
        if (matched) matchedCount++;
        continue;
      }

      // ── DEBITS (money out) ──
      if (row.debit > 0) {
        let matched = false, matchType = "", matchId = "";

        // 1. Credit card bill payment (bank debit for "CRED" / "CREDIT CARD" / "CC PAYMENT")
        if (descLower.includes("cred") || descLower.includes("credit card") || descLower.includes("cc payment")) {
          if (ccBillTotal > 0 && Math.abs(row.debit - ccBillTotal) < 2) {
            matchType = "credit_card_payment"; matchId = ""; matched = true;
          }
        }

        // 2. Match against expenses
        if (!matched) {
          const exp = (expensesRes.data ?? []).find((e) => !usedExp.has(e.id) && Math.abs(e.amount - row.debit) < 1);
          if (exp) { matchType = "expense"; matchId = exp.id; usedExp.add(exp.id); matched = true; }
        }

        // 3. Match against salaries
        if (!matched) {
          const sal = (salariesRes.data ?? []).find((s) => !usedSal.has(s.id) && Math.abs(s.amount - row.debit) < 1);
          if (sal) { matchType = "salary"; matchId = sal.id; usedSal.add(sal.id); matched = true; }
        }

        await supabase.from("bank_transactions").insert({
          date: row.date, description: desc, debit: row.debit, credit: 0,
          balance: row.balance ?? null, reference: row.reference ?? null,
          month, batch_id: batchId,
          reconciled: matched, matched_type: matched ? matchType : null, matched_id: matched ? matchId || null : null,
        });
        if (matched) matchedCount++;
      }
    }
  }

  await supabase.from("reconciliation_batches").update({
    status: "completed", matched_count: matchedCount, unmatched_count: totalCount - matchedCount,
  }).eq("id", batchId);

  return NextResponse.json({ batch_id: batchId, total: totalCount, matched: matchedCount, unmatched: totalCount - matchedCount });
}
