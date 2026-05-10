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

  // No duplicate filtering needed — the wizard API (V2) no longer creates
  // separate bank rows for Cashfree settlements. Bank credits matching Cashfree
  // UTRs are skipped entirely, and the Cashfree row is bank-confirmed instead.
  // credit_card_payment = you paying your CC bill (CRED/bank debit).
  // This is NOT a separate expense — the individual CC charges are already in spends.
  // So CC bill payment goes into ignored (it's an internal transfer, not a real expense).
  const skipTypes = new Set(["salary", "ignored", "credit_card_payment"]);

  return NextResponse.json({
    batch: batchRes.data,
    earnings: txns.filter((t) => t.credit > 0 && t.reconciled && t.matched_type !== "credit_card_payment"),
    spends: txns.filter((t) => t.debit > 0 && t.reconciled && !skipTypes.has(t.matched_type ?? "")),
    salaries: txns.filter((t) => t.matched_type === "salary" && t.reconciled),
    ignored: txns.filter((t) => (t.matched_type === "ignored" || t.matched_type === "credit_card_payment") && t.reconciled),
    unmatched: txns.filter((t) => !t.reconciled),
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
