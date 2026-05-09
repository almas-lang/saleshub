export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET — Get bank transactions for a batch, grouped by match type
 * PATCH — Update a bank transaction's match (confirm/reject/manual match)
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const supabase = supabaseAdmin;

  const [batchRes, txnsRes] = await Promise.all([
    supabase
      .from("reconciliation_batches")
      .select("*")
      .eq("id", batchId)
      .single(),
    supabase
      .from("bank_transactions")
      .select("*")
      .eq("batch_id", batchId)
      .order("date", { ascending: true }),
  ]);

  if (batchRes.error || !batchRes.data) {
    return NextResponse.json(
      { error: batchRes.error?.message ?? "Batch not found" },
      { status: 404 }
    );
  }

  const txns = txnsRes.data ?? [];

  // Bank settlement entries that match a Cashfree transaction entry are duplicates.
  // E.g., "A2AINT01 - CF PG SETTLEMENT" (HDFC, ₹53,734) is the same payment as
  // "Akshay · 8552053936" (Cashfree, ₹55,000). We keep the Cashfree entry (has customer info)
  // and hide the bank settlement confirmation.
  //
  // A bank entry is a "settlement confirmation" if:
  // - It's from HDFC (not Cashfree source)
  // - It's a credit (incoming)
  // - It matched as cashfree_settlement
  // These are just bank-side confirmations of Cashfree payments already shown.
  const isBankSettlementDupe = (t: typeof txns[0]) =>
    t.credit > 0 &&
    t.matched_type === "cashfree_settlement" &&
    t.bank_name !== "Cashfree" &&
    t.bank_name !== "HDFC Credit Card";

  const visibleTxns = txns.filter((t) => !isBankSettlementDupe(t));

  return NextResponse.json({
    batch: batchRes.data,
    earnings: visibleTxns.filter((t) => t.credit > 0 && t.reconciled && t.matched_type !== "credit_card_payment" && t.bank_name !== "Cashfree Settlement"),
    spends: visibleTxns.filter((t) => t.reconciled && t.matched_type !== "salary" && t.matched_type !== "ignored" && (t.debit > 0 || t.matched_type === "credit_card_payment") && t.bank_name !== "Cashfree Settlement"),
    salaries: visibleTxns.filter((t) => t.matched_type === "salary" && t.reconciled),
    ignored: visibleTxns.filter((t) => t.matched_type === "ignored"),
    unmatched: visibleTxns.filter((t) => !t.reconciled),
    all: visibleTxns,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const supabase = supabaseAdmin;

  // Delete all bank transactions for this batch
  const { error: txnError } = await supabase
    .from("bank_transactions")
    .delete()
    .eq("batch_id", batchId);

  if (txnError) {
    return NextResponse.json({ error: txnError.message }, { status: 500 });
  }

  // Delete the batch itself
  const { error: batchError } = await supabase
    .from("reconciliation_batches")
    .delete()
    .eq("id", batchId);

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const supabase = supabaseAdmin;
  const body = await request.json();

  const { transaction_id, reconciled, matched_type, matched_id, description } = body as {
    transaction_id: string;
    reconciled?: boolean;
    matched_type?: string | null;
    matched_id?: string | null;
    description?: string;
  };

  if (!transaction_id) {
    return NextResponse.json(
      { error: "transaction_id is required" },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (reconciled !== undefined) updateData.reconciled = reconciled;
  if (matched_type !== undefined) updateData.matched_type = matched_type ?? null;
  if (matched_id !== undefined) updateData.matched_id = matched_id ?? null;
  if (description !== undefined) updateData.description = description;

  const { error } = await supabase
    .from("bank_transactions")
    .update(updateData)
    .eq("id", transaction_id)
    .eq("batch_id", batchId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recalculate batch stats
  const { data: allTxns } = await supabase
    .from("bank_transactions")
    .select("reconciled")
    .eq("batch_id", batchId);

  const total = allTxns?.length ?? 0;
  const matched = allTxns?.filter((t) => t.reconciled).length ?? 0;

  await supabase
    .from("reconciliation_batches")
    .update({
      matched_count: matched,
      unmatched_count: total - matched,
    })
    .eq("id", batchId);

  return NextResponse.json({ success: true });
}
