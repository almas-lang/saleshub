export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { salaryPaymentSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search");

  let query = supabase
    .from("salary_payments")
    .select("*", { count: "exact" })
    .order("paid_date", { ascending: false });

  if (from) query = query.gte("paid_date", from);
  if (to) query = query.lte("paid_date", to);
  if (search) {
    query = query.or(
      `employee_name.ilike.%${search}%,employee_number.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, total: count ?? 0 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  const parsed = salaryPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("salary_payments")
    .insert({
      employee_name: parsed.data.employee_name,
      employee_number: parsed.data.employee_number,
      amount: parsed.data.amount,
      paid_date: parsed.data.paid_date,
      payment_mode: parsed.data.payment_mode || "UPI",
      notes: parsed.data.notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
