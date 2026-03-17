import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { format, parseISO } from "date-fns";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;

  const from = sp.get("from");
  const to = sp.get("to");

  let query = supabase
    .from("invoices")
    .select("id, total, paid_at, contact_id, contacts(first_name, last_name)")
    .eq("status", "paid")
    .not("paid_at", "is", null);

  if (from) query = query.gte("paid_at", from);
  if (to) query = query.lte("paid_at", to);

  const { data, error } = await query.order("paid_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const invoices = data ?? [];

  // Group by month
  const monthMap = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.paid_at) continue;
    const month = format(parseISO(inv.paid_at), "yyyy-MM");
    monthMap.set(month, (monthMap.get(month) ?? 0) + (inv.total ?? 0));
  }
  const byMonth = Array.from(monthMap, ([month, amount]) => ({
    month,
    amount,
  })).sort((a, b) => a.month.localeCompare(b.month));

  // Group by contact (top 10)
  const contactMap = new Map<string, { name: string; amount: number }>();
  for (const inv of invoices) {
    const contact = inv.contacts as unknown as {
      first_name: string;
      last_name: string | null;
    } | null;
    if (!contact) continue;
    const key = inv.contact_id ?? "unknown";
    const existing = contactMap.get(key) ?? {
      name: `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ""}`,
      amount: 0,
    };
    existing.amount += inv.total ?? 0;
    contactMap.set(key, existing);
  }
  const topCustomers = Array.from(contactMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map((c) => ({ contactName: c.name, amount: c.amount }));

  const total = invoices.reduce((s, i) => s + (i.total ?? 0), 0);

  return NextResponse.json({ byMonth, topCustomers, total });
}
