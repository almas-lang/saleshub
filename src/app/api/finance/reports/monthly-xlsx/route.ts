export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exportMultiSheetXLSX, type SheetData } from "@/lib/finance/export";
import { parseInvoiceItems } from "@/types/invoices";
import { calculateGST } from "@/lib/invoices/gst";

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function getMonthLabel(month: string): string {
  const d = new Date(month + "-01T00:00:00");
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month query param required (YYYY-MM)" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const [year, mon] = month.split("-").map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;

  // ── Sales: Paid invoices in the month ──
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, contacts(first_name, last_name, email, phone, company_name)")
    .eq("status", "paid")
    .gte("paid_at", `${from}T00:00:00`)
    .lte("paid_at", `${to}T23:59:59`)
    .order("paid_at", { ascending: true });

  // Also fetch paid installments in the month (for installment-based invoices)
  const { data: paidInstallments } = await supabase
    .from("installments")
    .select("*, invoices!inner(*, contacts(first_name, last_name, email, phone, company_name))")
    .eq("status", "paid")
    .gte("paid_at", `${from}T00:00:00`)
    .lte("paid_at", `${to}T23:59:59`)
    .order("paid_at", { ascending: true });

  const salesRows: Record<string, unknown>[] = [];
  let srNo = 1;

  // Non-installment invoices
  const nonInstInvoices = (invoices ?? []).filter((inv) => !inv.has_installments);
  for (const inv of nonInstInvoices) {
    const contact = inv.contacts as { first_name: string; last_name: string | null; email: string | null; phone: string | null; company_name: string | null } | null;
    const items = parseInvoiceItems(inv.items);
    const gst = calculateGST(items, inv.customer_state, inv.gst_rate ?? 18);

    salesRows.push({
      "Sr.No": srNo++,
      "Invoice No": inv.invoice_number,
      "Date of Invoice": fmtDate(inv.created_at.split("T")[0]),
      "Name of the customer": contact ? `${contact.first_name} ${contact.last_name ?? ""}`.trim() : "",
      "Email ID": contact?.email ?? "",
      "Mobile number": contact?.phone ?? "",
      "Place": "Online",
      "GST NO,if applicable": inv.gst_number || "No",
      "Nature of Product": "XW-Current",
      "Taxable Value": gst.subtotal || "",
      "CGST": gst.cgst || "",
      "SGST": gst.sgst || "",
      "IGST": gst.igst || "",
      "Total Invoice value": inv.total,
      "Date of Receipt": inv.paid_at ? fmtDate(inv.paid_at.split("T")[0]) : "",
      "Amount of Receipt": inv.total,
      "Mode of receipt(Cash/UPI/ any other Mode )": inv.payment_gateway === "cashfree" ? "Credit card - Cashfree" : "UPI",
      "Mail Status": inv.status === "sent" || inv.status === "paid" ? "Sent" : "Draft",
      "Remarks": "",
    });
  }

  // Installment-based payments
  for (const inst of paidInstallments ?? []) {
    const inv = inst.invoices as unknown as {
      invoice_number: string;
      created_at: string;
      total: number;
      gst_number: string | null;
      customer_state: string | null;
      gst_rate: number | null;
      items: unknown;
      has_installments: boolean;
      payment_gateway: string | null;
      status: string;
      contacts: { first_name: string; last_name: string | null; email: string | null; phone: string | null; company_name: string | null } | null;
    };
    const contact = inv.contacts;

    salesRows.push({
      "Sr.No": srNo++,
      "Invoice No": inv.invoice_number,
      "Date of Invoice": fmtDate(inv.created_at.split("T")[0]),
      "Name of the customer": contact ? `${contact.first_name} ${contact.last_name ?? ""}`.trim() : "",
      "Email ID": contact?.email ?? "",
      "Mobile number": contact?.phone ?? "",
      "Place": "Online",
      "GST NO,if applicable": inv.gst_number || "No",
      "Nature of Product": "XW-Current",
      "Taxable Value": "",
      "CGST": "",
      "SGST": "",
      "IGST": "",
      "Total Invoice value": inv.total,
      "Date of Receipt": inst.paid_at ? fmtDate(inst.paid_at.split("T")[0]) : "",
      "Amount of Receipt": inst.amount,
      "Mode of receipt(Cash/UPI/ any other Mode )": inst.payment_gateway === "cashfree" ? "Credit card - Cashfree" : "UPI",
      "Mail Status": "Sent",
      "Remarks": `Installment #${inst.installment_number}`,
    });
  }

  // Add totals row
  const totalReceipts = salesRows.reduce((s, r) => s + (Number(r["Amount of Receipt"]) || 0), 0);
  salesRows.push({
    "Sr.No": "",
    "Invoice No": "",
    "Date of Invoice": "",
    "Name of the customer": "",
    "Email ID": "",
    "Mobile number": "",
    "Place": "",
    "GST NO,if applicable": "",
    "Nature of Product": "",
    "Taxable Value": "",
    "CGST": "",
    "SGST": "",
    "IGST": "",
    "Total Invoice value": "",
    "Date of Receipt": "",
    "Amount of Receipt": totalReceipts,
    "Mode of receipt(Cash/UPI/ any other Mode )": "",
    "Mail Status": "",
    "Remarks": "",
  });

  // ── Expenses: Transactions of type=expense in the month ──
  const { data: expenses } = await supabase
    .from("transactions")
    .select("*")
    .eq("type", "expense")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  const expenseRows: Record<string, unknown>[] = [];
  let expSrNo = 1;

  for (const exp of expenses ?? []) {
    expenseRows.push({
      "Sr.No": expSrNo++,
      "Date of Expenses": fmtDate(exp.date),
      "Name of the party from whom purchased": exp.description ?? exp.category,
      "Place": "Bangalore",
      "GSTN, if available ": exp.vendor_gstin ?? "",
      "Nature of Expenditure ": exp.category,
      "Taxable Value": exp.gst_applicable && exp.gst_rate ? Math.round(exp.amount / (1 + exp.gst_rate / 100)) : "",
      "CGST": exp.gst_cgst ?? "",
      "SGST": exp.gst_sgst ?? "",
      "IGST": exp.gst_igst ?? "",
      "Total": exp.amount,
      "Payment Date ": fmtDate(exp.date),
      "Amount Paid ": exp.amount,
      "Mode of payment (Cash/Bank)": exp.payment_mode ?? "UPI",
    });
  }

  // Expenses total
  const totalExpenses = expenseRows.reduce((s, r) => s + (Number(r["Amount Paid "]) || 0), 0);
  expenseRows.push({
    "Sr.No": "",
    "Date of Expenses": "",
    "Name of the party from whom purchased": "",
    "Place": "",
    "GSTN, if available ": "",
    "Nature of Expenditure ": "",
    "Taxable Value": "",
    "CGST": "",
    "SGST": "",
    "IGST": "",
    "Total": "",
    "Payment Date ": "",
    "Amount Paid ": totalExpenses,
    "Mode of payment (Cash/Bank)": "",
  });

  // ── Salary: salary_payments in the month ──
  const { data: salaryPayments } = await supabase
    .from("salary_payments")
    .select("*")
    .gte("paid_date", from)
    .lte("paid_date", to)
    .order("paid_date", { ascending: true });

  const salaryRows: Record<string, unknown>[] = [];
  for (const sp of salaryPayments ?? []) {
    salaryRows.push({
      "Employee name": sp.employee_name,
      "Employee number": sp.employee_number,
      "Paid": fmtDate(sp.paid_date),
      "Amount": sp.amount,
      "Notes": sp.notes ?? "",
    });
  }

  // Build sheets matching the user's Excel format
  const monthLabel = getMonthLabel(month);
  const companyHeader = "Name of the Company :EXPWAVE PRIVATE LIMITED";

  const sheets: SheetData[] = [
    {
      name: "Sales",
      headerRows: [
        ["SALES  DETAILS  FORMAT "],
        [companyHeader],
        ["Month  :", monthLabel],
        [], // empty row before data
      ],
      rows: salesRows,
    },
    {
      name: "Expenses",
      headerRows: [
        ["Folder with you in the expenses, I have written"],
        [companyHeader],
        ["Month  :", monthLabel],
        [],
      ],
      rows: expenseRows,
    },
    {
      name: "Salary",
      headerRows: [],
      rows: salaryRows,
    },
  ];

  const result = await exportMultiSheetXLSX(
    sheets,
    `${monthLabel} Expwave - Sales and expenses`
  );

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
