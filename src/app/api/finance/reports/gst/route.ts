import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateGSTReport } from "@/lib/finance/calculations";
import { format, parseISO } from "date-fns";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;

  const from = sp.get("from");
  const to = sp.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to dates required" },
      { status: 400 }
    );
  }

  // Fetch paid invoices with GST
  const [invoicesRes, expensesRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("paid_at, gst_amount, customer_state, total")
      .eq("status", "paid")
      .gte("paid_at", from)
      .lte("paid_at", to),
    supabase
      .from("transactions")
      .select("date, amount, gst_applicable, gst_rate, gst_cgst, gst_sgst, gst_igst")
      .eq("type", "expense")
      .eq("gst_applicable", true)
      .gte("date", from)
      .lte("date", to),
  ]);

  const invoices = (invoicesRes.data ?? []).map((i) => ({
    paid_at: i.paid_at ?? "",
    gst_amount: i.gst_amount ?? 0,
    customer_state: i.customer_state,
    total: i.total ?? 0,
  }));

  // Use actual GST values if available, else fallback to 18% estimate
  const expenseGST = (expensesRes.data ?? []).map((e) => {
    const actualGst = (e.gst_cgst ?? 0) + (e.gst_sgst ?? 0) + (e.gst_igst ?? 0);
    const gst = actualGst > 0
      ? actualGst
      : Math.round(e.amount * ((e.gst_rate ?? 18) / 100));
    return {
      month: format(parseISO(e.date), "yyyy-MM"),
      gst,
    };
  });

  const report = calculateGSTReport(invoices, expenseGST, { from, to });
  return NextResponse.json(report);
}
