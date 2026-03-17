import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculatePnL } from "@/lib/finance/calculations";
import type { Transaction } from "@/types/finance";

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

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const report = calculatePnL(data as Transaction[], { from, to });
  return NextResponse.json(report);
}
