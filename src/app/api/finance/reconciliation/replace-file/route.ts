export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Replace a specific file type in an existing reconciliation batch.
 * Deletes all bank_transactions of that source type and re-processes the new file data.
 */
export async function POST(request: Request) {
  const supabase = supabaseAdmin;
  const body = await request.json();

  const { batch_id, file_type, card_rows } = body as {
    batch_id: string;
    file_type: "card" | "bank" | "cashfree";
    card_rows?: { date: string; description: string; amount: number; type: "debit" | "credit" }[];
  };

  if (!batch_id || !file_type) {
    return NextResponse.json({ error: "batch_id and file_type required" }, { status: 400 });
  }

  // Map file_type to bank_name
  const bankNameMap: Record<string, string> = {
    card: "HDFC Credit Card",
    bank: "HDFC",
    cashfree: "Cashfree",
  };
  const bankName = bankNameMap[file_type];

  // Delete existing rows of this type from the batch
  const { count: deletedCount } = await supabase
    .from("bank_transactions")
    .delete({ count: "exact" })
    .eq("batch_id", batch_id)
    .eq("bank_name", bankName);

  let insertedCount = 0;
  let matchedCount = 0;

  // Re-process based on file type
  if (file_type === "card" && card_rows?.length) {
    // Get the batch month
    const { data: batch } = await supabase
      .from("reconciliation_batches")
      .select("month, year")
      .eq("id", batch_id)
      .single();

    const month = batch ? `${batch.year}-${String(batch.month).padStart(2, "0")}` : "";

    // Fetch expenses for matching
    const { data: expenses } = await supabase
      .from("transactions")
      .select("id, amount, date, description, category, payment_mode")
      .eq("type", "expense");
    const matchedExpenseIds = new Set<string>();

    for (const row of card_rows) {
      if (row.type === "credit") {
        await supabase.from("bank_transactions").insert({
          date: row.date, description: `CC Bill Payment: ${row.description}`,
          debit: row.amount, credit: 0, bank_name: "HDFC Credit Card",
          month, batch_id, reconciled: true, matched_type: "credit_card_payment",
        });
        matchedCount++;
        insertedCount++;
        continue;
      }

      const rowDate = new Date(row.date + "T00:00:00");
      let matched = false;

      for (const exp of expenses ?? []) {
        if (matchedExpenseIds.has(exp.id) || Math.abs(exp.amount - row.amount) >= 1) continue;
        const dayDiff = Math.abs((rowDate.getTime() - new Date(exp.date + "T00:00:00").getTime()) / 86400000);
        if (dayDiff <= 5) {
          matched = true;
          matchedExpenseIds.add(exp.id);
          await supabase.from("bank_transactions").insert({
            date: row.date, description: `CC: ${row.description}`, debit: row.amount, credit: 0,
            bank_name: "HDFC Credit Card", month, batch_id,
            reconciled: true, matched_type: "expense", matched_id: exp.id,
          });
          await supabase.from("transactions").update({ payment_mode: "Credit Card" }).eq("id", exp.id);
          matchedCount++;
          break;
        }
      }

      if (!matched) {
        await supabase.from("bank_transactions").insert({
          date: row.date, description: `CC: ${row.description}`, debit: row.amount, credit: 0,
          bank_name: "HDFC Credit Card", month, batch_id, reconciled: false,
        });
      }
      insertedCount++;
    }
  }

  // Update batch counts
  const { data: all } = await supabase
    .from("bank_transactions")
    .select("reconciled")
    .eq("batch_id", batch_id);

  const total = all?.length ?? 0;
  const totalMatched = all?.filter((r) => r.reconciled).length ?? 0;

  await supabase.from("reconciliation_batches").update({
    total_count: total,
    matched_count: totalMatched,
    unmatched_count: total - totalMatched,
  }).eq("id", batch_id);

  return NextResponse.json({
    deleted: deletedCount,
    inserted: insertedCount,
    matched: matchedCount,
    total,
  });
}
