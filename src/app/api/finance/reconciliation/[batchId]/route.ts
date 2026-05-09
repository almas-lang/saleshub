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

  // Credit card payments are spends (you paying your card bill), not earnings
  // Cashfree Settlement rows from settlement report are reference data, not separate entries
  return NextResponse.json({
    batch: batchRes.data,
    earnings: txns.filter((t) => t.credit > 0 && t.reconciled && t.matched_type !== "credit_card_payment" && t.bank_name !== "Cashfree Settlement"),
    spends: txns.filter((t) => t.reconciled && t.matched_type !== "salary" && t.matched_type !== "ignored" && (t.debit > 0 || t.matched_type === "credit_card_payment") && t.bank_name !== "Cashfree Settlement"),
    salaries: txns.filter((t) => t.matched_type === "salary" && t.reconciled),
    ignored: txns.filter((t) => t.matched_type === "ignored"),
    unmatched: txns.filter((t) => !t.reconciled),
    all: txns,
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

  const { transaction_id, reconciled, matched_type, matched_id } = body as {
    transaction_id: string;
    reconciled: boolean;
    matched_type?: string | null;
    matched_id?: string | null;
  };

  if (!transaction_id) {
    return NextResponse.json(
      { error: "transaction_id is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("bank_transactions")
    .update({
      reconciled,
      matched_type: matched_type ?? null,
      matched_id: matched_id ?? null,
    })
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
