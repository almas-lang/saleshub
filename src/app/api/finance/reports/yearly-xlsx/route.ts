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

function getMonthName(monthNum: number): string {
  return [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][monthNum - 1];
}

/**
 * Returns array of YYYY-MM strings for a financial year.
 * FY "2025-26" → ["2025-04", "2025-05", ..., "2026-03"]
 */
function getFYMonths(fy: string): string[] {
  const startYear = parseInt(fy.split("-")[0], 10);
  const months: string[] = [];
  for (let m = 4; m <= 12; m++) {
    months.push(`${startYear}-${String(m).padStart(2, "0")}`);
  }
  for (let m = 1; m <= 3; m++) {
    months.push(`${startYear + 1}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fy = searchParams.get("fy"); // e.g. "2025-26"
  if (!fy || !/^\d{4}-\d{2}$/.test(fy)) {
    return NextResponse.json(
      { error: "fy query param required (e.g. 2025-26)" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const fyMonths = getFYMonths(fy);
  const from = `${fyMonths[0]}-01`;
  const lastMonth = fyMonths[fyMonths.length - 1];
  const [ly, lm] = lastMonth.split("-").map(Number);
  const lastDay = new Date(ly, lm, 0).getDate();
  const to = `${lastMonth}-${String(lastDay).padStart(2, "0")}`;

  // ── Fetch all data for the FY ──
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, contacts(first_name, last_name, email, phone, company_name)")
    .eq("status", "paid")
    .gte("paid_at", `${from}T00:00:00`)
    .lte("paid_at", `${to}T23:59:59`)
    .order("paid_at", { ascending: true });

  const { data: paidInstallments } = await supabase
    .from("installments")
    .select("*, invoices!inner(*, contacts(first_name, last_name, email, phone, company_name))")
    .eq("status", "paid")
    .gte("paid_at", `${from}T00:00:00`)
    .lte("paid_at", `${to}T23:59:59`)
    .order("paid_at", { ascending: true });

  const { data: expenses } = await supabase
    .from("transactions")
    .select("*")
    .eq("type", "expense")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  const { data: salaryPayments } = await supabase
    .from("salary_payments")
    .select("*")
    .gte("paid_date", from)
    .lte("paid_date", to)
    .order("paid_date", { ascending: true });

  // ── Build Sales rows with monthly subtotals ──
  const salesRows: Record<string, unknown>[] = [];
  let srNo = 1;

  // Group invoices by month
  const nonInstInvoices = (invoices ?? []).filter((inv) => !inv.has_installments);
  const allSalesEntries: { month: string; row: Record<string, unknown> }[] = [];

  for (const inv of nonInstInvoices) {
    const contact = inv.contacts as { first_name: string; last_name: string | null; email: string | null; phone: string | null; company_name: string | null } | null;
    const items = parseInvoiceItems(inv.items);
    const gst = calculateGST(items, inv.customer_state, inv.gst_rate ?? 18);
    const paidMonth = inv.paid_at ? inv.paid_at.substring(0, 7) : "";

    allSalesEntries.push({
      month: paidMonth,
      row: {
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
        "Mode of receipt": inv.payment_gateway === "cashfree" ? "Credit card - Cashfree" : "UPI",
        "Mail Status": "Sent",
        "Remarks": "",
      },
    });
  }

  for (const inst of paidInstallments ?? []) {
    const inv = inst.invoices as unknown as {
      invoice_number: string; created_at: string; total: number;
      gst_number: string | null; payment_gateway: string | null;
      contacts: { first_name: string; last_name: string | null; email: string | null; phone: string | null } | null;
    };
    const contact = inv.contacts;
    const paidMonth = inst.paid_at ? inst.paid_at.substring(0, 7) : "";

    allSalesEntries.push({
      month: paidMonth,
      row: {
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
        "Mode of receipt": inst.payment_gateway === "cashfree" ? "Credit card - Cashfree" : "UPI",
        "Mail Status": "Sent",
        "Remarks": `Installment #${inst.installment_number}`,
      },
    });
  }

  // Add rows grouped by month with subtotals
  let grandTotalSales = 0;
  for (const month of fyMonths) {
    const monthEntries = allSalesEntries.filter((e) => e.month === month);
    if (monthEntries.length === 0) continue;

    for (const entry of monthEntries) {
      salesRows.push(entry.row);
    }

    const monthTotal = monthEntries.reduce((s, e) => s + (Number(e.row["Amount of Receipt"]) || 0), 0);
    grandTotalSales += monthTotal;
    const [y, m] = month.split("-").map(Number);

    salesRows.push({
      "Sr.No": "", "Invoice No": "", "Date of Invoice": "",
      "Name of the customer": `--- ${getMonthName(m)} ${y} Subtotal ---`,
      "Email ID": "", "Mobile number": "", "Place": "",
      "GST NO,if applicable": "", "Nature of Product": "",
      "Taxable Value": "", "CGST": "", "SGST": "", "IGST": "",
      "Total Invoice value": "",
      "Date of Receipt": "", "Amount of Receipt": monthTotal,
      "Mode of receipt": "", "Mail Status": "", "Remarks": "",
    });
  }

  // Grand total
  salesRows.push({
    "Sr.No": "", "Invoice No": "", "Date of Invoice": "",
    "Name of the customer": `=== FY ${fy} GRAND TOTAL ===`,
    "Email ID": "", "Mobile number": "", "Place": "",
    "GST NO,if applicable": "", "Nature of Product": "",
    "Taxable Value": "", "CGST": "", "SGST": "", "IGST": "",
    "Total Invoice value": "",
    "Date of Receipt": "", "Amount of Receipt": grandTotalSales,
    "Mode of receipt": "", "Mail Status": "", "Remarks": "",
  });

  // ── Build Expense rows with monthly subtotals ──
  const expenseRows: Record<string, unknown>[] = [];
  let expSrNo = 1;
  let grandTotalExpenses = 0;

  for (const month of fyMonths) {
    const monthExpenses = (expenses ?? []).filter((e) => e.date.substring(0, 7) === month);
    if (monthExpenses.length === 0) continue;

    for (const exp of monthExpenses) {
      expenseRows.push({
        "Sr.No": expSrNo++,
        "Date of Expenses": fmtDate(exp.date),
        "Name of the party": exp.description ?? exp.category,
        "Place": "Bangalore",
        "GSTN": exp.vendor_gstin ?? "",
        "Nature of Expenditure": exp.category,
        "Taxable Value": exp.gst_applicable && exp.gst_rate ? Math.round(exp.amount / (1 + exp.gst_rate / 100)) : "",
        "CGST": exp.gst_cgst ?? "",
        "SGST": exp.gst_sgst ?? "",
        "IGST": exp.gst_igst ?? "",
        "Total": exp.amount,
        "Payment Date": fmtDate(exp.date),
        "Amount Paid": exp.amount,
        "Mode of payment": exp.payment_mode ?? "UPI",
      });
    }

    const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
    grandTotalExpenses += monthTotal;
    const [y, m] = month.split("-").map(Number);

    expenseRows.push({
      "Sr.No": "", "Date of Expenses": "",
      "Name of the party": `--- ${getMonthName(m)} ${y} Subtotal ---`,
      "Place": "", "GSTN": "", "Nature of Expenditure": "",
      "Taxable Value": "", "CGST": "", "SGST": "", "IGST": "",
      "Total": "", "Payment Date": "",
      "Amount Paid": monthTotal, "Mode of payment": "",
    });
  }

  expenseRows.push({
    "Sr.No": "", "Date of Expenses": "",
    "Name of the party": `=== FY ${fy} GRAND TOTAL ===`,
    "Place": "", "GSTN": "", "Nature of Expenditure": "",
    "Taxable Value": "", "CGST": "", "SGST": "", "IGST": "",
    "Total": "", "Payment Date": "",
    "Amount Paid": grandTotalExpenses, "Mode of payment": "",
  });

  // ── Build Salary rows ──
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

  const totalSalary = (salaryPayments ?? []).reduce((s, p) => s + p.amount, 0);
  salaryRows.push({
    "Employee name": `=== FY ${fy} TOTAL ===`,
    "Employee number": "",
    "Paid": "",
    "Amount": totalSalary,
    "Notes": "",
  });

  const companyHeader = "Name of the Company :EXPWAVE PRIVATE LIMITED";

  const sheets: SheetData[] = [
    {
      name: "Sales",
      headerRows: [
        ["SALES  DETAILS  FORMAT "],
        [companyHeader],
        [`Financial Year: ${fy}`],
        [],
      ],
      rows: salesRows,
    },
    {
      name: "Expenses",
      headerRows: [
        [companyHeader],
        [`Financial Year: ${fy}`],
        [],
      ],
      rows: expenseRows,
    },
    {
      name: "Salary",
      headerRows: [
        [companyHeader],
        [`Financial Year: ${fy}`],
        [],
      ],
      rows: salaryRows,
    },
  ];

  const result = await exportMultiSheetXLSX(
    sheets,
    `FY ${fy} Expwave - Sales and expenses`
  );

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
