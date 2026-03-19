import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { createCashfreeOrder } from "@/lib/payments/cashfree";
import { CashfreeCheckout } from "@/components/invoices/cashfree-checkout";

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inst?: string }>;
}) {
  const { id } = await params;
  const { inst: instParam } = await searchParams;

  const { data: invoice } = await supabaseAdmin
    .from("invoices")
    .select("*, contacts(id, first_name, last_name, email, phone)")
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  // For installment invoices, determine the target installment
  let targetInstallment: { id: string; installment_number: number; amount: number; status: string } | null = null;
  let totalInstallments = 0;

  if (invoice.has_installments) {
    const { data: installments } = await supabaseAdmin
      .from("installments")
      .select("id, installment_number, amount, status")
      .eq("invoice_id", id)
      .order("installment_number", { ascending: true });

    totalInstallments = installments?.length ?? 0;

    if (installments?.length) {
      // Check if all installments are paid
      const allPaid = installments.every((i) => i.status === "paid");
      if (allPaid) {
        return (
          <div className="flex min-h-screen items-center justify-center bg-slate-50">
            <div className="mx-auto max-w-sm text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100">
                <svg className="size-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold">All Payments Received</h1>
              <p className="mt-2 text-sm text-slate-500">
                All installments for invoice {invoice.invoice_number} ({formatCurrency(invoice.total)}) have been paid. Thank you!
              </p>
            </div>
          </div>
        );
      }

      if (instParam) {
        // Specific installment requested
        targetInstallment = installments.find((i) => i.id === instParam) ?? null;
      }
      if (!targetInstallment) {
        // Default: next pending installment (earliest due)
        targetInstallment = installments.find((i) => i.status === "pending" || i.status === "overdue") ?? null;
      }
    }
  }

  if (invoice.status === "paid" && !targetInstallment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="mx-auto max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100">
            <svg className="size-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">Payment Received</h1>
          <p className="mt-2 text-sm text-slate-500">
            Invoice {invoice.invoice_number} ({formatCurrency(invoice.total)}) has already been paid. Thank you!
          </p>
        </div>
      </div>
    );
  }

  const contact = invoice.contacts;
  const clientName = contact
    ? `${contact.first_name} ${contact.last_name ?? ""}`.trim()
    : "Customer";

  // Determine amount based on installment vs full payment
  const isInstallmentPayment = !!targetInstallment;
  const paymentAmount = isInstallmentPayment ? targetInstallment!.amount : invoice.total;

  // Create a Cashfree PG order
  const result = await createCashfreeOrder(
    isInstallmentPayment ? `inst-${targetInstallment!.id}` : id,
    paymentAmount,
    contact?.email ?? "",
    contact?.phone ?? "",
    clientName,
    isInstallmentPayment ? id : undefined
  );

  if (!result.success || !result.paymentSessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="mx-auto max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-100">
            <svg className="size-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">Payment Unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">
            Unable to initialize payment. Please contact support or try again later.
          </p>
          <p className="mt-1 text-xs text-slate-400">{result.error}</p>
        </div>
      </div>
    );
  }

  const mode = process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="mx-auto max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-indigo-100">
          <svg className="size-8 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">Pay Invoice</h1>
        <p className="mt-2 text-sm text-slate-500">
          {invoice.invoice_number} &middot; {formatCurrency(paymentAmount)}
        </p>
        {isInstallmentPayment && (
          <p className="text-sm text-slate-500">
            Installment {targetInstallment!.installment_number} of {totalInstallments}
          </p>
        )}
        <p className="text-sm text-slate-400">{clientName}</p>

        <CashfreeCheckout
          paymentSessionId={result.paymentSessionId}
          mode={mode}
        />

        <p className="mt-6 text-xs text-slate-400">
          Secured by Cashfree Payments
        </p>
      </div>
    </div>
  );
}
