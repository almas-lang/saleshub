export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
  const month = searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month query param required (YYYY-MM)" }, { status: 400 });
  }

  const supabase = supabaseAdmin;
  const [year, mon] = month.split("-").map(Number);
  const monStr = String(mon).padStart(2, "0");
  const monthLabel = getMonthLabel(month);

  // Find reconciliation batch for this month
  const { data: batch } = await supabase
    .from("reconciliation_batches")
    .select("id")
    .eq("month", monStr)
    .eq("year", year)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!batch) {
    return NextResponse.json({ error: `No reconciliation found for ${monthLabel}. Complete reconciliation first.` }, { status: 404 });
  }

  // Get ALL bank_transactions for this batch
  const { data: txns } = await supabase
    .from("bank_transactions")
    .select("*")
    .eq("batch_id", batch.id)
    .eq("reconciled", true)
    .order("date", { ascending: true });

  const allTxns = txns ?? [];

  // ══════════════════════════════════════════════════
  // SALES — from earnings (credit > 0, matched to invoices)
  // ══════════════════════════════════════════════════
  const earnings = allTxns.filter((t) => t.credit > 0 && t.matched_type !== "credit_card_payment");
  const salesRows: Record<string, unknown>[] = [];
  let srNo = 1;

  for (const txn of earnings) {
    let invoiceNo = "";
    let customerName = txn.description;
    let email = "";
    let phone = "";
    let gstNo = "No";
    let taxableValue: number | string = "";
    let cgst: number | string = "";
    let sgst: number | string = "";
    let igst: number | string = "";
    let totalInvoiceValue = txn.credit;
    let paymentMode = txn.bank_name === "Cashfree" ? "Cashfree" : "UPI";
    let remarks = "";

    // Fetch invoice details if matched
    if (txn.matched_id && (txn.matched_type === "invoice" || txn.matched_type === "cashfree_settlement")) {
      const { data: inv } = await supabase
        .from("invoices")
        .select("*, contacts(first_name, last_name, email, phone, company_name)")
        .eq("id", txn.matched_id)
        .single();

      if (inv) {
        const contact = inv.contacts as { first_name: string; last_name: string | null; email: string | null; phone: string | null } | null;
        invoiceNo = inv.invoice_number;
        customerName = contact ? `${contact.first_name} ${contact.last_name ?? ""}`.trim() : txn.description;
        email = contact?.email ?? "";
        phone = contact?.phone ?? "";
        gstNo = inv.gst_number || "No";
        totalInvoiceValue = inv.total;

        const items = parseInvoiceItems(inv.items);
        const gst = calculateGST(items, null, inv.gst_rate ?? 18);
        taxableValue = gst.subtotal || "";
        cgst = gst.cgst || "";
        sgst = gst.sgst || "";
        igst = gst.igst || "";

        paymentMode = inv.payment_gateway === "cashfree" ? "Cashfree" : "UPI";
        remarks = txn.bank_name === "Cashfree" ? "Via Cashfree" : "Direct UPI";
      }
    }

    salesRows.push({
      "Sr.No": srNo++,
      "Invoice No": invoiceNo,
      "Date of Invoice": fmtDate(txn.date),
      "Name of the customer": customerName,
      "Email ID": email,
      "Mobile number": phone,
      "Place": "Online",
      "GST NO,if applicable": gstNo,
      "Nature of Product": "XW-Current",
      "Taxable Value": taxableValue,
      "CGST": cgst,
      "SGST": sgst,
      "IGST": igst,
      "Total Invoice value": totalInvoiceValue,
      "Date of Receipt": fmtDate(txn.date),
      "Amount of Receipt": txn.credit,
      "Mode of receipt": paymentMode,
      "Mail Status": "Sent",
      "Remarks": remarks,
    });
  }

  // Totals
  const totalReceipts = salesRows.reduce((s, r) => s + (Number(r["Amount of Receipt"]) || 0), 0);
  salesRows.push({
    "Sr.No": "", "Invoice No": "", "Date of Invoice": "", "Name of the customer": "",
    "Email ID": "", "Mobile number": "", "Place": "", "GST NO,if applicable": "",
    "Nature of Product": "", "Taxable Value": "", "CGST": "", "SGST": "", "IGST": "",
    "Total Invoice value": "", "Date of Receipt": "", "Amount of Receipt": totalReceipts,
    "Mode of receipt": "", "Mail Status": "", "Remarks": "",
  });

  // ══════════════════════════════════════════════════
  // EXPENSES — from spends (debit > 0, not salary/ignored/cc_payment)
  // ══════════════════════════════════════════════════
  const skipTypes = new Set(["salary", "ignored", "credit_card_payment"]);
  const spends = allTxns.filter((t) => t.debit > 0 && !skipTypes.has(t.matched_type ?? ""));
  const expenseRows: Record<string, unknown>[] = [];
  let expSrNo = 1;

  for (const txn of spends) {
    let description = txn.description;
    let category = "Miscellaneous";
    let vendorGstin = "";
    let gstCgst: number | string = "";
    let gstSgst: number | string = "";
    let gstIgst: number | string = "";
    let taxableValue: number | string = "";
    let paymentMode = txn.bank_name ?? "Bank";

    // Fetch expense details if matched
    if (txn.matched_id && txn.matched_type === "expense") {
      const { data: exp } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", txn.matched_id)
        .single();
      if (exp) {
        description = exp.description ?? exp.category;
        category = exp.category;
        vendorGstin = exp.vendor_gstin ?? "";
        gstCgst = exp.gst_cgst ?? "";
        gstSgst = exp.gst_sgst ?? "";
        gstIgst = exp.gst_igst ?? "";
        taxableValue = exp.gst_rate && exp.gst_rate > 0 ? Math.round(exp.amount / (1 + exp.gst_rate / 100)) : "";
        paymentMode = exp.payment_mode ?? txn.bank_name ?? "Bank";
      }
    }

    expenseRows.push({
      "Sr.No": expSrNo++,
      "Date of Expenses": fmtDate(txn.date),
      "Name of the party from whom purchased": description,
      "Place": "Bangalore",
      "GSTN, if available ": vendorGstin,
      "Nature of Expenditure ": category,
      "Taxable Value": taxableValue,
      "CGST": gstCgst,
      "SGST": gstSgst,
      "IGST": gstIgst,
      "Total": txn.debit,
      "Payment Date ": fmtDate(txn.date),
      "Amount Paid ": txn.debit,
      "Mode of payment (Cash/Bank)": paymentMode,
    });
  }

  const totalExpenses = expenseRows.reduce((s, r) => s + (Number(r["Amount Paid "]) || 0), 0);
  expenseRows.push({
    "Sr.No": "", "Date of Expenses": "", "Name of the party from whom purchased": "",
    "Place": "", "GSTN, if available ": "", "Nature of Expenditure ": "",
    "Taxable Value": "", "CGST": "", "SGST": "", "IGST": "", "Total": "",
    "Payment Date ": "", "Amount Paid ": totalExpenses, "Mode of payment (Cash/Bank)": "",
  });

  // ══════════════════════════════════════════════════
  // SALARY — from salary entries in the batch (matched_type=salary)
  // ══════════════════════════════════════════════════
  const salaryTxns = allTxns.filter((t) => t.matched_type === "salary");
  const salaryRows: Record<string, unknown>[] = [];

  for (const txn of salaryTxns) {
    let empName = txn.description;
    let empNumber = "";
    let notes = "";

    // Fetch salary payment details if matched
    if (txn.matched_id) {
      const { data: sp } = await supabase
        .from("salary_payments")
        .select("*")
        .eq("id", txn.matched_id)
        .single();
      if (sp) {
        empName = sp.employee_name;
        empNumber = sp.employee_number;
        notes = sp.notes ?? "";
      }
    }

    salaryRows.push({
      "Employee name": empName,
      "Employee number": empNumber,
      "Paid": fmtDate(txn.date),
      "Amount": txn.debit,
      "Notes": notes,
    });
  }

  // Build sheets
  const companyHeader = "Name of the Company :EXPWAVE PRIVATE LIMITED";

  const sheets: SheetData[] = [
    {
      name: "Sales",
      headerRows: [
        ["SALES  DETAILS  FORMAT "],
        [companyHeader],
        ["Month  :", monthLabel],
        ["Reconciliation Status:", "Reconciled"],
        [],
      ],
      rows: salesRows,
    },
    {
      name: "Expenses",
      headerRows: [
        [companyHeader],
        ["Month  :", monthLabel],
        ["Reconciliation Status:", "Reconciled"],
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

  const result = await exportMultiSheetXLSX(sheets, `${monthLabel} Expwave - Sales and expenses`);

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
