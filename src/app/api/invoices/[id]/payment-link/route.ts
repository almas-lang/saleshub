import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Generate a payment link for an invoice.
 * Uses the /pay/[id] page which creates a Cashfree PG order on-the-fly.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, payment_link, status")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json(
      { error: "Invoice is already paid" },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const paymentLink = `${appUrl}/pay/${id}`;

  // Save payment link to invoice
  await supabase
    .from("invoices")
    .update({ payment_link: paymentLink, payment_gateway: "cashfree" })
    .eq("id", id);

  return NextResponse.json({ payment_link: paymentLink });
}
