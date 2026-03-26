import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { format, parseISO } from "date-fns";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;

  const from = sp.get("from");
  const to = sp.get("to");

  // Fetch fully-paid invoices (non-installment) and paid installments
  let invoiceQuery = supabase
    .from("invoices")
    .select("id, total, paid_at, contact_id, contacts(first_name, last_name)")
    .eq("status", "paid")
    .eq("has_installments", false)
    .not("paid_at", "is", null);

  let installmentQuery = supabase
    .from("installments")
    .select("amount, paid_at, invoice_id")
    .eq("status", "paid");

  if (from) {
    invoiceQuery = invoiceQuery.gte("paid_at", from);
    installmentQuery = installmentQuery.gte("paid_at", from);
  }
  if (to) {
    invoiceQuery = invoiceQuery.lte("paid_at", to);
    installmentQuery = installmentQuery.lte("paid_at", to);
  }

  const [invoicesResult, installmentsResult] = await Promise.all([
    invoiceQuery.order("paid_at", { ascending: true }),
    installmentQuery.order("paid_at", { ascending: true }),
  ]);

  if (invoicesResult.error) {
    return NextResponse.json({ error: invoicesResult.error.message }, { status: 500 });
  }

  const invoices = invoicesResult.data ?? [];
  const installments = installmentsResult.data ?? [];

  // Fetch parent invoice contact info for installments
  const instInvoiceIds = [...new Set(installments.map((i) => i.invoice_id))];
  let instContactMap: Record<string, { contact_id: string | null; name: string }> = {};
  if (instInvoiceIds.length > 0) {
    const { data: parentInvs } = await supabase
      .from("invoices")
      .select("id, contact_id, contacts(first_name, last_name)")
      .in("id", instInvoiceIds);
    for (const p of parentInvs ?? []) {
      const contact = p.contacts as unknown as { first_name: string; last_name: string | null } | null;
      instContactMap[p.id] = {
        contact_id: p.contact_id,
        name: contact ? `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ""}` : "Unknown",
      };
    }
  }

  // Group by month
  const monthMap = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.paid_at) continue;
    const month = format(parseISO(inv.paid_at), "yyyy-MM");
    monthMap.set(month, (monthMap.get(month) ?? 0) + (inv.total ?? 0));
  }
  for (const inst of installments) {
    if (!inst.paid_at) continue;
    const month = format(parseISO(inst.paid_at), "yyyy-MM");
    monthMap.set(month, (monthMap.get(month) ?? 0) + (Number(inst.amount) || 0));
  }
  const byMonth = Array.from(monthMap, ([month, amount]) => ({
    month,
    amount,
  })).sort((a, b) => a.month.localeCompare(b.month));

  // Top 10 customers
  const contactRevMap = new Map<string, { name: string; amount: number }>();
  for (const inv of invoices) {
    const contact = inv.contacts as unknown as {
      first_name: string;
      last_name: string | null;
    } | null;
    if (!contact) continue;
    const key = inv.contact_id ?? "unknown";
    const existing = contactRevMap.get(key) ?? {
      name: `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ""}`,
      amount: 0,
    };
    existing.amount += inv.total ?? 0;
    contactRevMap.set(key, existing);
  }
  for (const inst of installments) {
    const parent = instContactMap[inst.invoice_id];
    if (!parent) continue;
    const key = parent.contact_id ?? "unknown";
    const existing = contactRevMap.get(key) ?? { name: parent.name, amount: 0 };
    existing.amount += Number(inst.amount) || 0;
    contactRevMap.set(key, existing);
  }
  const topCustomers = Array.from(contactRevMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const invoiceTotal = invoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const installmentTotal = installments.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const total = invoiceTotal + installmentTotal;

  return NextResponse.json({ byMonth, topCustomers, total });
}
